import logging
import json
import time
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime

from app.setting.config import parameters as param


def _create_rotating_file_handler(log_path):
    last_error = None
    for attempt in range(1, 11):
        try:
            return RotatingFileHandler(
                log_path,
                maxBytes=param.LOG_MAX_BYTES,
                backupCount=param.LOG_BACKUP_COUNT,
                encoding="utf-8",
            )
        except PermissionError as error:
            last_error = error
            if attempt == 10:
                break
            time.sleep(0.5)

    raise last_error


def setup_logging():
    log_path = Path(param.LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = _create_rotating_file_handler(log_path)
    file_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if param.DEBUG else logging.INFO)

    if not any(
        isinstance(handler, RotatingFileHandler)
        and getattr(handler, "baseFilename", None) == file_handler.baseFilename
        for handler in root_logger.handlers
    ):
        root_logger.addHandler(file_handler)

    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine.Engine").setLevel(logging.INFO if param.DEBUG else logging.WARNING)

    return log_path


def setup_console_logging():
    console_logger = logging.getLogger("app.console")
    console_logger.setLevel(logging.INFO)
    console_logger.propagate = False

    if not any(
        isinstance(handler, logging.StreamHandler)
        and getattr(handler, "_project403_console", False)
        for handler in console_logger.handlers
    ):
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler._project403_console = True
        stream_handler.setFormatter(logging.Formatter("%(message)s"))
        console_logger.addHandler(stream_handler)

    return console_logger


def get_log_root():
    return Path(param.LOG_DIR)


def get_request_log_path(resource, current_time=None):
    timestamp = current_time or datetime.now()
    date_key = timestamp.strftime("%Y-%m-%d")
    safe_resource = "".join(
        char if char.isalnum() or char in ("-", "_") else "-"
        for char in resource.lower()
    ).strip("-") or "app"
    log_dir = get_log_root() / date_key
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / f"{safe_resource}-{date_key}.log"


def get_request_resource(path):
    segments = [segment for segment in path.strip("/").split("/") if segment]

    if segments[:2] == ["api", "db"]:
        return "app-api-db"

    if segments[:2] == ["api", "admin"]:
        return "app-api-admin"

    if segments[:2] == ["api", "auth"]:
        return "app-api-auth"

    if segments[:2] == ["api", "users"]:
        return "app-api-users"

    if segments and segments[0] == "api":
        return f"app-api-{segments[1]}" if len(segments) > 1 else "app-api"

    return "app"


def write_request_log(resource, payload):
    log_path = get_request_log_path(resource)
    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(json.dumps(payload, ensure_ascii=False, default=str))
        log_file.write("\n")
