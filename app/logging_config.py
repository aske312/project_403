import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.setting.config import parameters as param


def setup_logging():
    log_path = Path(param.LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=param.LOG_MAX_BYTES,
        backupCount=param.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
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
