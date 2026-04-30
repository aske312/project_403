from dotenv import load_dotenv
import subprocess
import os
import sys

load_dotenv()

def get_build_id():
    build_id = os.getenv("BUILD_ID")
    if build_id and build_id.lower() != "dev":
        return build_id

    branch = get_project_branch()

    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
        return f"{branch}@{commit}"
    except Exception:
        return f"{branch}@local"


def get_project_branch():
    branch = os.getenv("PROJECT_BRANCH") or os.getenv("GIT_BRANCH") or os.getenv("BRANCH")
    if branch:
        return branch

    try:
        return subprocess.check_output(
            ["git", "branch", "--show-current"],
            stderr=subprocess.DEVNULL,
        ).decode().strip() or "detached"
    except Exception:
        return "unknown"


class Parameters:
    # App
    APP_NAME = os.getenv("APP_NAME", "Project_403")
    VERSION = f"v {os.getenv('VERSION', '0.0.1')} build {get_build_id()}"
    PROJECT_BRANCH = get_project_branch()
    PYTHON_VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    ENV = os.getenv("ENV", "development")
    DEBUG = os.getenv("DEBUG", "False") == "True"
    AUTO_CREATE_TABLES = os.getenv("AUTO_CREATE_TABLES", "True") == "True"

    # Logging
    LOG_FILE = os.getenv("LOG_FILE", "logs/app.log")
    LOG_MAX_BYTES = int(os.getenv("LOG_MAX_BYTES", 1024 * 1024))
    LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", 3))

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))

    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5432/messenger_db",
    )
    DB_FALLBACK_URL = os.getenv("DB_FALLBACK_URL", "sqlite+aiosqlite:///./local.db")
    DB_FALLBACK_ENABLED = os.getenv("DB_FALLBACK_ENABLED", "True") == "True"

    # Auth
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

parameters = Parameters()

