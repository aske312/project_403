from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
import time

from app.api.auth.login import get_current_user
from app.db import session
from app.db.models import Base, User
from app.feature_flags import is_feature_enabled
from app.setting.config import parameters as param

router = APIRouter()


async def require_admin_services_user(current_user: User = Depends(get_current_user)):
    if not is_feature_enabled("admin_services", current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin services access is disabled by feature policy.",
        )

    return current_user


async def get_database_version(conn):
    backend = session.get_database_backend()

    if backend == "postgresql":
        result = await conn.execute(text("SHOW server_version"))
        return f"PostgreSQL {result.scalar()}"

    if backend == "sqlite":
        result = await conn.execute(text("SELECT sqlite_version()"))
        return f"SQLite {result.scalar()}"

    return backend


@router.get("/api/db/check_connect")
async def check_connect(current_user: User = Depends(require_admin_services_user)):
    started = time.perf_counter()

    try:
        async with session.engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            value = result.scalar()
            version = await get_database_version(conn)

        return {
            "status": "ok",
            "db_response": value,
            "backend": session.get_database_backend(),
            "requested_backend": session.get_requested_database_backend(),
            "fallback_active": session.is_database_fallback_active(),
            "version": version,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "startup_ms": param.DATABASE_STARTUP_DURATION_MS,
            "database_url": session.get_public_database_url(),
        }
    except Exception as e:
        return {
            "status": "error",
            "backend": session.get_database_backend(),
            "requested_backend": session.get_requested_database_backend(),
            "fallback_active": session.is_database_fallback_active(),
            "database_url": session.get_public_database_url(),
            "version": None,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "startup_ms": param.DATABASE_STARTUP_DURATION_MS,
            "error": str(e)
        }


@router.post("/api/db/init")
async def initialize_database(current_user: User = Depends(require_admin_services_user)):
    try:
        await session.init_db()

        return {
            "status": "ok",
            "backend": session.get_database_backend(),
            "requested_backend": session.get_requested_database_backend(),
            "fallback_active": session.is_database_fallback_active(),
            "database_url": session.get_public_database_url(),
            "version": None,
            "tables": sorted(Base.metadata.tables.keys())
        }
    except Exception as e:
        return {
            "status": "error",
            "backend": session.get_database_backend(),
            "requested_backend": session.get_requested_database_backend(),
            "fallback_active": session.is_database_fallback_active(),
            "database_url": session.get_public_database_url(),
            "error": str(e)
        }
