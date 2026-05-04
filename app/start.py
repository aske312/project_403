from fastapi import FastAPI
import asyncio
from contextlib import suppress
import json
import logging
import time

from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.setting.config import parameters as param
from app.api.auth.login import router as api_auth_login
from app.api.auth.registration import router as api_auth_registration
from app.api.db import router as api_db
from app.api.admin import router as api_admin
from app.api.chats import router as api_chats
from app.setting.redis_client import close_redis, init_redis
from app.db.session import get_public_database_url, init_active_database, init_db
from app.logging_config import get_request_resource, setup_console_logging, setup_logging, write_request_log
from app.runtime_state import mark_runtime_seen, start_runtime_session, stop_runtime_session
from fastapi.middleware.cors import CORSMiddleware

setup_logging()
logger = logging.getLogger(__name__)
console_logger = setup_console_logging()
runtime_heartbeat_task = None

SENSITIVE_LOG_KEYS = {
    "access_token",
    "api_key",
    "authorization",
    "cookie",
    "database_url",
    "jwt",
    "password",
    "password_hash",
    "private_key",
    "refresh_token",
    "secret",
    "smtp_password",
    "token",
}


def redact_log_payload(value):
    if isinstance(value, dict):
        return {
            key: "[redacted]" if key.lower() in SENSITIVE_LOG_KEYS else redact_log_payload(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [redact_log_payload(item) for item in value]

    return value


def body_for_log(body, content_type=""):
    text = body.decode("utf-8", errors="replace")

    if "application/json" not in content_type.lower():
        return text[:10000]

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text[:10000]

    return json.dumps(redact_log_payload(payload), ensure_ascii=False, default=str)[:10000]

app = FastAPI(
    title=param.APP_NAME,
    version=param.VERSION
)

app.include_router(api_admin)
app.include_router(api_chats)
app.include_router(api_db)
app.include_router(api_auth_registration)
app.include_router(api_auth_login)
app.add_middleware(
    CORSMiddleware,
    allow_origins=param.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_UNAVAILABLE_DETAIL = "\u0421\u0435\u0440\u0432\u0438\u0441 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d"


async def runtime_heartbeat():
    while True:
        await asyncio.sleep(param.RUNTIME_HEARTBEAT_SECONDS)
        mark_runtime_seen()


@app.middleware("http")
async def log_requests(request, call_next):
    started = time.perf_counter()
    request_body = await request.body()
    request_content_type = request.headers.get("content-type", "")

    async def receive():
        return {
            "type": "http.request",
            "body": request_body,
            "more_body": False,
        }

    request_text = body_for_log(request_body, request_content_type)
    resource = get_request_resource(request.url.path)
    status_code = 500
    headers = {}
    content_type = ""
    response_text = ""

    try:
        request._receive = receive
        response = await call_next(request)
        status_code = response.status_code
        headers = dict(response.headers)
        content_type = headers.get("content-type", "")
        response_text = "[response body not logged]"

        return response
    except SQLAlchemyError as exc:
        status_code = 503
        response_text = SERVICE_UNAVAILABLE_DETAIL
        logger.exception("Database error: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status_code,
            content={"detail": SERVICE_UNAVAILABLE_DETAIL},
        )
    except (ConnectionError, OSError) as exc:
        status_code = 503
        response_text = SERVICE_UNAVAILABLE_DETAIL
        logger.exception("Database connection error: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status_code,
            content={"detail": SERVICE_UNAVAILABLE_DETAIL},
        )
    except Exception as exc:
        response_text = str(exc)[:10000]
        logger.exception("Unhandled backend error: %s %s", request.method, request.url.path)
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000

        write_request_log(
            resource,
            {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "event": "http_request",
                "resource": resource,
                "request": {
                    "method": request.method,
                    "path": request.url.path,
                    "query": str(request.url.query),
                    "body": request_text[:10000],
                },
                "response": {
                    "status_code": status_code,
                    "content_type": content_type,
                    "body": response_text[:10000],
                },
                "duration_ms": round(duration_ms, 1),
            },
        )

        console_logger.info(
            "%s %s -> %s %.1fms",
            request.method,
            request.url.path,
            status_code,
            duration_ms,
        )


@app.on_event("startup")
async def startup():
    global runtime_heartbeat_task

    start_runtime_session()
    runtime_heartbeat_task = asyncio.create_task(runtime_heartbeat())

    startup_started = time.perf_counter()

    try:
        logger.info(
            "Starting %s %s env=%s branch=%s",
            param.APP_NAME,
            param.VERSION,
            param.ENVIRONMENTS,
            param.PROJECT_BRANCH,
        )

        database_started = time.perf_counter()
        try:
            if param.AUTO_CREATE_TABLES:
                await init_db()
            else:
                logger.info("Database auto-create is disabled")
                await init_active_database(create_missing_tables=False)
        except Exception as exc:
            logger.exception("Database initialization skipped: %s", exc)
        else:
            logger.info("Database initialized: %s", get_public_database_url())
        finally:
            param.DATABASE_STARTUP_DURATION_MS = round(
                (time.perf_counter() - database_started) * 1000,
                1,
            )

        try:
            await init_redis()
        except Exception as exc:
            logger.warning("Redis initialization failed, using local fallback rate limit: %s", exc)
    finally:
        param.STARTUP_DURATION_MS = round((time.perf_counter() - startup_started) * 1000, 1)
        logger.info("Startup completed in %.1fms", param.STARTUP_DURATION_MS)


@app.on_event("shutdown")
async def shutdown():
    global runtime_heartbeat_task

    if runtime_heartbeat_task is not None:
        runtime_heartbeat_task.cancel()
        with suppress(asyncio.CancelledError):
            await runtime_heartbeat_task
        runtime_heartbeat_task = None

    with suppress(Exception):
        await close_redis()

    stop_runtime_session()
