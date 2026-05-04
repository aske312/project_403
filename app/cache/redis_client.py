import contextlib
import asyncio
import logging
from dataclasses import dataclass
from urllib.parse import urlparse

from app.setting.config import parameters as param

logger = logging.getLogger(__name__)

redis_client = None


def _encode_command(*parts):
    payload = [f"*{len(parts)}\r\n".encode("utf-8")]
    for part in parts:
        data = str(part).encode("utf-8")
        payload.append(f"${len(data)}\r\n".encode("utf-8"))
        payload.append(data)
        payload.append(b"\r\n")
    return b"".join(payload)


async def _read_line(reader):
    line = await reader.readline()
    if not line:
        raise ConnectionError("Redis connection closed.")
    if not line.endswith(b"\r\n"):
        raise ConnectionError("Invalid Redis response.")
    return line[:-2]


async def _read_response(reader):
    prefix = await reader.readexactly(1)

    if prefix == b"+":
        return (await _read_line(reader)).decode("utf-8")

    if prefix == b"-":
        message = (await _read_line(reader)).decode("utf-8")
        raise RuntimeError(message)

    if prefix == b":":
        return int((await _read_line(reader)).decode("utf-8"))

    if prefix == b"$":
        length = int((await _read_line(reader)).decode("utf-8"))
        if length == -1:
            return None
        data = await reader.readexactly(length)
        await reader.readexactly(2)
        return data.decode("utf-8")

    if prefix == b"*":
        length = int((await _read_line(reader)).decode("utf-8"))
        if length == -1:
            return None
        return [await _read_response(reader) for _ in range(length)]

    raise ConnectionError("Unsupported Redis response type.")


@dataclass(frozen=True)
class SimpleRedisConfig:
    host: str
    port: int
    db: int
    password: str | None


class SimpleRedisClient:
    def __init__(self, url):
        parsed = urlparse(url)
        if parsed.scheme != "redis":
            raise RuntimeError("Redis URL must use the redis:// scheme.")

        password = parsed.password or None
        path = parsed.path.lstrip("/")
        db = int(path) if path else 0

        self.config = SimpleRedisConfig(
            host=parsed.hostname or "localhost",
            port=parsed.port or 6379,
            db=db,
            password=password,
        )

    async def _execute(self, *parts):
        reader, writer = await asyncio.open_connection(self.config.host, self.config.port)
        try:
            if self.config.password:
                writer.write(_encode_command("AUTH", self.config.password))
                await writer.drain()
                await _read_response(reader)

            if self.config.db:
                writer.write(_encode_command("SELECT", self.config.db))
                await writer.drain()
                await _read_response(reader)

            writer.write(_encode_command(*parts))
            await writer.drain()
            return await _read_response(reader)
        finally:
            writer.close()
            with contextlib.suppress(Exception):
                await writer.wait_closed()

    async def ping(self):
        return await self._execute("PING")

    async def delete(self, key):
        return await self._execute("DEL", key)

    async def eval(self, script, numkeys, *args):
        return await self._execute("EVAL", script, numkeys, *args)


def get_redis_client():
    return redis_client


async def init_redis():
    global redis_client

    if redis_client is not None:
        return redis_client

    redis_client = SimpleRedisClient(param.REDIS_URL)
    await redis_client.ping()
    logger.info("Redis connected: %s", param.REDIS_URL)
    return redis_client


async def close_redis():
    global redis_client
    redis_client = None
