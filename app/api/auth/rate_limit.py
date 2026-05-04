import asyncio
import hashlib
import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.setting.redis_client import get_redis_client
from app.setting.config import parameters as param

logger = logging.getLogger(__name__)

RATE_LIMIT_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttl_seconds = tonumber(ARGV[5])

redis.call("ZREMRANGEBYSCORE", key, 0, now - window_seconds)
local count = redis.call("ZCARD", key)

if count >= limit then
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    local retry_after = 1

    if oldest[2] then
        retry_after = math.max(math.floor(tonumber(oldest[2]) + window_seconds - now), 1)
    end

    return {0, retry_after}
end

redis.call("ZADD", key, now, member)
redis.call("EXPIRE", key, ttl_seconds)
return {1, 0}
"""

_local_rate_limits = defaultdict(deque)
_local_rate_limit_lock = asyncio.Lock()


def get_client_key(request: Request):
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def make_rate_limit_key(scope, request, identifier):
    client_key = get_client_key(request)
    normalized_identifier = str(identifier or "anonymous").strip().lower()
    raw_key = f"{scope}:{client_key}:{normalized_identifier}"
    key_hash = hashlib.sha1(raw_key.encode("utf-8")).hexdigest()
    return f"{param.REDIS_RATE_LIMIT_PREFIX}:{scope}:{key_hash}"


async def reset_rate_limit(key):
    redis_client = get_redis_client()
    if redis_client is not None:
        try:
            await redis_client.delete(key)
        except Exception:
            logger.warning("Redis rate limit reset failed, falling back to local store.", exc_info=True)

    async with _local_rate_limit_lock:
        _local_rate_limits.pop(key, None)


async def _enforce_local_rate_limit(key, *, limit, window_seconds, detail):
    now = time.monotonic()
    window_started_at = now - window_seconds

    async with _local_rate_limit_lock:
        attempts = _local_rate_limits[key]

        while attempts and attempts[0] <= window_started_at:
            attempts.popleft()

        if len(attempts) >= limit:
            retry_after = max(int(attempts[0] + window_seconds - now), 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
                headers={"Retry-After": str(retry_after)},
            )

        attempts.append(now)


async def enforce_rate_limit(key, *, limit, window_seconds, detail):
    redis_client = get_redis_client()
    if redis_client is None:
        await _enforce_local_rate_limit(key, limit=limit, window_seconds=window_seconds, detail=detail)
        return

    now = int(time.time())
    member = f"{now}:{uuid.uuid4().hex}"

    try:
        allowed, retry_after = await redis_client.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            now,
            window_seconds,
            limit,
            member,
            max(window_seconds + 1, param.REDIS_RATE_LIMIT_KEY_TTL_SECONDS),
        )
    except Exception:
        logger.warning("Redis rate limit check failed, falling back to local store.", exc_info=True)
        await _enforce_local_rate_limit(key, limit=limit, window_seconds=window_seconds, detail=detail)
        return

    if int(allowed) == 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(max(int(retry_after), 1))},
        )
