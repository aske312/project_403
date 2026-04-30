from fastapi import FastAPI
import json
import logging
import time

from app.setting.config import parameters as param
from app.api.auth.login import router as api_auth_login
from app.api.auth.registration import router as api_auth_registration
from app.api.db import router as api_db
from app.api.admin import router as api_admin
from app.db.session import get_public_database_url, init_db
from app.logging_config import get_request_resource, setup_logging, write_request_log
from fastapi.middleware.cors import CORSMiddleware

setup_logging()
logger = logging.getLogger(__name__)

SENSITIVE_LOG_KEYS = {
    "access_token",
    "authorization",
    "jwt",
    "password",
    "password_hash",
    "refresh_token",
    "secret",
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
app.include_router(api_db)
app.include_router(api_auth_registration)
app.include_router(api_auth_login)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

        logger.info(
            "%s %s -> %s %.1fms",
            request.method,
            request.url.path,
            status_code,
            duration_ms,
        )


@app.on_event("startup")
async def startup():
    startup_started = time.perf_counter()

    try:
        logger.info(
            "Starting %s %s env=%s branch=%s",
            param.APP_NAME,
            param.VERSION,
            param.ENV,
            param.PROJECT_BRANCH,
        )

        if not param.AUTO_CREATE_TABLES:
            logger.info("Database auto-create is disabled")
            return

        database_started = time.perf_counter()
        try:
            await init_db()
        except Exception as exc:
            logger.exception("Database initialization skipped: %s", exc)
        else:
            logger.info("Database initialized: %s", get_public_database_url())
        finally:
            param.DATABASE_STARTUP_DURATION_MS = round(
                (time.perf_counter() - database_started) * 1000,
                1,
            )
    finally:
        param.STARTUP_DURATION_MS = round((time.perf_counter() - startup_started) * 1000, 1)
        logger.info("Startup completed in %.1fms", param.STARTUP_DURATION_MS)
