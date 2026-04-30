from fastapi import FastAPI
import logging
import time

from app.setting.config import parameters as param
from app.api.db import router as api_db
from app.api.debug import router as api_debug
from app.db.session import get_public_database_url, init_db
from app.logging_config import setup_logging
from fastapi.middleware.cors import CORSMiddleware

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=param.APP_NAME,
    version=param.VERSION
)

app.include_router(api_debug)
app.include_router(api_db)
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
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "%s %s -> %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.on_event("startup")
async def startup():
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

    try:
        await init_db()
    except Exception as exc:
        logger.exception("Database initialization skipped: %s", exc)
    else:
        logger.info("Database initialized: %s", get_public_database_url())
