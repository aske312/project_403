import logging
from importlib.metadata import metadata, version
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.logging_config import get_log_root
from app.setting.config import parameters as param

router = APIRouter()
logger = logging.getLogger(__name__)


def get_package_stack(package_name):
    package_metadata = metadata(package_name)
    return {
        "name": package_metadata["Name"],
        "version": version(package_name),
    }


@router.get("/api/admin/health")
def health():
    stack = get_package_stack("fastapi")

    return {
        "status": "ok",
        "app": param.APP_NAME,
        "language": "Python",
        "language_version": param.PYTHON_VERSION,
        "stack": stack["name"],
        "stack_version": stack["version"],
        "version": param.VERSION,
        "startup_ms": param.STARTUP_DURATION_MS,
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
def list_logs():
    log_root = get_log_root()
    if not log_root.exists():
        return {"status": "ok", "logs": []}

    logs = []
    for log_path in sorted(log_root.glob("*/*.log"), reverse=True):
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

    return {"status": "ok", "logs": logs}


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
