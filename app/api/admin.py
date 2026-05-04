import logging
from math import ceil
from importlib.metadata import metadata, version
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.api.auth.login import get_current_user, get_optional_current_user
from app.db.models import User
from app.db.session import get_database_backend, get_public_database_url
from app.feature_flags import get_feature_flags, is_feature_enabled
from app.logging_config import get_log_root
from app.runtime_state import get_online_user_count, get_runtime_metrics
from app.setting.config import parameters as param

router = APIRouter()
logger = logging.getLogger(__name__)


def get_log_resource_name(log_path: Path) -> str:
    stem = log_path.stem
    if stem.startswith("app-"):
        remainder = stem.removeprefix("app-")
        if "-v." in remainder:
            return remainder.split("-v.", 1)[0]
    return stem.rsplit("-", 3)[0] if "-" in stem else stem


def get_package_stack(package_name):
    package_metadata = metadata(package_name)
    return {
        "name": package_metadata["Name"],
        "version": version(package_name),
    }


async def require_admin_logs_user(current_user: User = Depends(get_current_user)):
    if not is_feature_enabled("admin_logs", current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin logs access is disabled by feature policy.",
        )

    return current_user


@router.get("/api/admin/health")
async def health(current_user: User | None = Depends(get_optional_current_user)):
    stack = get_package_stack("fastapi")
    runtime = get_runtime_metrics()
    feature_flags = get_feature_flags(current_user)

    return {
        "status": "ok",
        "app": param.APP_NAME,
        "language": "Python",
        "language_version": param.PYTHON_VERSION,
        "stack": stack["name"],
        "stack_version": stack["version"],
        "version": param.VERSION,
        "startup_ms": param.STARTUP_DURATION_MS,
        "build_ms": param.BUILD_DURATION_MS,
        "total_runtime_ms": runtime["total_runtime_ms"],
        "current_runtime_ms": runtime["current_runtime_ms"],
        "launch_count": runtime["launch_count"],
        "online_users": get_online_user_count(),
        "branch": param.PROJECT_BRANCH,
        "environment": param.ENVIRONMENTS,
        "feature_flags": feature_flags,
        "integrations": {
            "docker_services_enabled": param.DOCKER_SERVICES_ENABLED,
            "compose_file": "config/docker-compose.yml",
            "database": {
                "backend": get_database_backend(),
                "url": get_public_database_url(),
                "postgresql_enabled": param.POSTGRESQL_ENABLED,
                "fallback_enabled": param.DB_FALLBACK_ENABLED,
            },
            "redis": {
                "enabled": param.REDIS_ENABLED,
                "mode": "redis" if param.REDIS_ENABLED else "local_fallback",
            },
            "realtime": {
                "enabled": param.WEBSOCKET_ENABLED,
                "transport": "websocket" if param.WEBSOCKET_ENABLED else "http_fallback",
                "requires": "uvicorn[standard] or websockets/wsproto",
            },
        },
    }


@router.get("/api/admin/logs/app")
def download_app_log(current_user: User = Depends(require_admin_logs_user)):
    log_path = Path(param.LOG_FILE)
    if not log_path.exists():
        logger.warning("Log download requested before log file exists: %s", log_path)
        raise HTTPException(status_code=404, detail="Log file is not available yet.")

    logger.info("Application log downloaded: %s", log_path)
    return Response(
        content=log_path.read_bytes(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{log_path.name}"',
        },
    )


@router.get("/api/admin/logs")
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=10),
    current_user: User = Depends(require_admin_logs_user),
):
    log_root = get_log_root()
    if not log_root.exists():
        return {
            "status": "ok",
            "logs": [],
            "page": 1,
            "page_size": page_size,
            "total": 0,
            "total_pages": 1,
        }

    logs = []
    seen_paths = set()
    build_log_root = log_root / param.BUILD_ID
    search_root = build_log_root if build_log_root.exists() else log_root

    for log_path in search_root.rglob("*.log"):
        if not log_path.is_file():
            continue

        resolved_path = log_path.resolve()
        if resolved_path in seen_paths:
            continue
        seen_paths.add(resolved_path)

        stat = log_path.stat()
        relative_path = log_path.relative_to(log_root).as_posix()
        relative_parts = Path(relative_path).parts
        if relative_parts and relative_parts[0] != param.BUILD_ID:
            continue
        date_key = relative_parts[1] if len(relative_parts) >= 3 else "root"
        logs.append(
            {
                "date": date_key,
                "file": log_path.name,
                "resource": get_log_resource_name(log_path),
                "size": stat.st_size,
                "updated_at": stat.st_mtime,
                "download_url": f"/api/admin/logs/{relative_path}",
            }
        )

    logs.sort(key=lambda item: (item["updated_at"], item["file"]), reverse=True)

    total = len(logs)
    total_pages = max(ceil(total / page_size), 1)
    current_page = min(page, total_pages)
    start_index = (current_page - 1) * page_size
    page_logs = logs[start_index:start_index + page_size]

    return {
        "status": "ok",
        "logs": page_logs,
        "page": current_page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


@router.get("/api/admin/logs/{log_path:path}")
def download_log(
    log_path: str,
    current_user: User = Depends(require_admin_logs_user),
):
    log_root = get_log_root().resolve()
    target_path = (log_root / log_path).resolve()

    if not str(target_path).startswith(str(log_root)) or target_path.suffix != ".log":
        raise HTTPException(status_code=400, detail="Invalid log path.")

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="Log file is not available.")

    logger.info("Log downloaded: %s", target_path)
    return Response(
        content=target_path.read_bytes(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{target_path.name}"',
        },
    )


@router.get("/api/admin/check")
def check_get():
    return {
        "status": "OK",
        "message": "GET is ok"
    }
