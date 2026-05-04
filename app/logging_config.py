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


def _attach_file_handler(logger, log_path, level):
    handler = _create_rotating_file_handler(log_path)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    handler.setLevel(level)

    if not any(
        isinstance(existing, RotatingFileHandler)
        and getattr(existing, "baseFilename", None) == handler.baseFilename
        for existing in logger.handlers
    ):
        logger.addHandler(handler)

    return handler


def _remove_stream_handlers(logger):
    logger.handlers = [
        handler for handler in logger.handlers
        if not isinstance(handler, logging.StreamHandler)
    ]


def setup_logging():
    log_path = Path(param.LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if param.DEBUG else logging.INFO)
    _remove_stream_handlers(root_logger)
    _attach_file_handler(root_logger, log_path, logging.INFO if param.DEBUG else logging.INFO)

    db_log_path = Path(param.DB_LOG_FILE)
    db_log_path.parent.mkdir(parents=True, exist_ok=True)
    db_level = logging.INFO if param.DEBUG else logging.INFO

    for logger_name in ("app.db", "app.db.session", "app.db.sql"):
        dedicated_logger = logging.getLogger(logger_name)
        dedicated_logger.setLevel(db_level)
        dedicated_logger.propagate = False
        _remove_stream_handlers(dedicated_logger)
        _attach_file_handler(dedicated_logger, db_log_path, db_level)

    for logger_name in ("sqlalchemy", "sqlalchemy.engine", "sqlalchemy.engine.Engine", "sqlalchemy.pool", "aiosqlite"):
        library_logger = logging.getLogger(logger_name)
        library_logger.setLevel(logging.WARNING)
        library_logger.propagate = False
        _remove_stream_handlers(library_logger)

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
    time_key = timestamp.strftime("%H_%M")
    safe_resource = "".join(
        char if char.isalnum() or char in ("-", "_") else "-"
        for char in resource.lower()
    ).strip("-") or "app"
    log_kind = safe_resource.removeprefix("app-")
    log_dir = get_log_root() / param.BUILD_ID / date_key / param.BUILD_TAG
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / f"app-{log_kind}-v.{param.APP_VERSION}.log"


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
