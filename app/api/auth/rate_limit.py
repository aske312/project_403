import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


attempts_by_key = defaultdict(deque)


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
    return f"{scope}:{client_key}:{normalized_identifier}"


def reset_rate_limit(key):
    attempts_by_key.pop(key, None)


def enforce_rate_limit(key, *, limit, window_seconds, detail):
    now = time.monotonic()
    window_started_at = now - window_seconds
    attempts = attempts_by_key[key]

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
