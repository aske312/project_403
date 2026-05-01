import logging
from math import ceil
from importlib.metadata import metadata, version
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.admin_commands import (
    list_admin_commands,
    queue_admin_command,
    read_admin_command_state,
)
from app.api.auth.login import get_current_user
from app.db.models import User
from app.db.session import is_dev_environment
from app.logging_config import get_log_root
from app.runtime_state import get_runtime_metrics
from app.setting.config import parameters as param

router = APIRouter()
logger = logging.getLogger(__name__)


def get_package_stack(package_name):
    package_metadata = metadata(package_name)
    return {
        "name": package_metadata["Name"],
        "version": version(package_name),
    }


async def require_admin_user(current_user: User = Depends(get_current_user)):
    is_owner = str(current_user.role or "").strip().lower() == "owner"
    if not current_user.is_super_admin or not is_owner or not is_dev_environment():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin command access requires DEV environment, owner role and super admin permission.",
        )

    return current_user


@router.get("/api/admin/health")
def health():
    stack = get_package_stack("fastapi")
    runtime = get_runtime_metrics()

    return {
        "status": "ok",
        "app": param.APP_NAME,
        "language": "Python",
        "language_version": param.PYTHON_VERSION,
        "stack": stack["name"],
        "stack_version": stack["version"],
        "version": param.VERSION,
        "startup_ms": param.STARTUP_DURATION_MS,
        "total_runtime_ms": runtime["total_runtime_ms"],
        "current_runtime_ms": runtime["current_runtime_ms"],
        "launch_count": runtime["launch_count"],
        "branch": param.PROJECT_BRANCH,
        "environment": param.ENV,
    }


@router.get("/api/admin/logs/app")
def download_app_log():
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
def list_logs(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=10)):
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
    for log_path in log_root.glob("*/*.log"):
        if not log_path.is_file():
            continue

        stat = log_path.stat()
        logs.append(
            {
                "date": log_path.parent.name,
                "file": log_path.name,
                "resource": log_path.stem.rsplit("-", 3)[0],
                "size": stat.st_size,
                "updated_at": stat.st_mtime,
                "download_url": f"/api/admin/logs/{log_path.parent.name}/{log_path.name}",
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


@router.get("/api/admin/commands")
async def get_admin_commands(current_user: User = Depends(require_admin_user)):
    return {
        "status": "ok",
        "commands": list_admin_commands(),
        "pending": read_admin_command_state(),
        "requested_by": current_user.email,
    }


@router.post("/api/admin/commands/{command_id}")
async def run_admin_command(command_id: str, current_user: User = Depends(require_admin_user)):
    command = queue_admin_command(command_id, current_user.email)
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin command is not available.",
        )

    logger.warning(
        "Admin command queued: command=%s requested_by=%s",
        command_id,
        current_user.email,
    )
    return {
        "status": "queued",
        "command": command,
        "message": "Command queued for project launcher.",
    }


@router.get("/api/admin/logs/{date_key}/{file_name}")
def download_log(date_key: str, file_name: str):
    log_root = get_log_root().resolve()
    log_path = (log_root / date_key / file_name).resolve()

    if not str(log_path).startswith(str(log_root)) or log_path.suffix != ".log":
        raise HTTPException(status_code=400, detail="Invalid log path.")

    if not log_path.exists() or not log_path.is_file():
        raise HTTPException(status_code=404, detail="Log file is not available.")

    logger.info("Log downloaded: %s", log_path)
    return Response(
        content=log_path.read_bytes(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{log_path.name}"',
        },
    )


@router.get("/api/admin/check")
def check_get():
    return {
        "status": "OK",
        "message": "GET is ok"
    }
