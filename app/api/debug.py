import logging
from importlib.metadata import metadata, version
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.setting.config import parameters as param

router = APIRouter()
logger = logging.getLogger(__name__)


def get_package_stack(package_name):
    package_metadata = metadata(package_name)
    return {
        "name": package_metadata["Name"],
        "version": version(package_name),
    }


@router.get("/api/debug/health")
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
        "branch": param.PROJECT_BRANCH,
        "environment": param.ENV,
    }


@router.get("/api/debug/logs/app")
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


@router.get("/api/debug/check")
def check_get():
    return {
        "status": "OK",
        "message": "GET is ok"
    }

@router.post("/api/debug/check")
def check_post():
    return {
        "status": "OK",
        "message": "POST is ok"
    }

@router.put("/api/debug/check")
def check_put():
    return {
        "status": "OK",
        "message": "PUT is ok"
    }

@router.patch("/api/debug/check")
def check_patch():
    return {
        "status": "OK",
        "message": "PATCH is ok"
    }


@router.delete("/api/debug/check")
def check_delete():
    return {
        "status": "OK",
        "message": "DELETE is ok"
    }
