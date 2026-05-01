from dotenv import load_dotenv
import subprocess
import os
import sys

load_dotenv()


def get_bool_env(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_build_id():
    build_id = os.getenv("BUILD_ID")
    if build_id and build_id.lower() != "dev":
        return build_id

    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return "local"


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
    STARTUP_DURATION_MS = None
    DATABASE_STARTUP_DURATION_MS = None
    RUNTIME_STATE_FILE = os.getenv("RUNTIME_STATE_FILE", "logs/runtime-state.json")
    RUNTIME_HEARTBEAT_SECONDS = max(int(os.getenv("RUNTIME_HEARTBEAT_SECONDS", 10)), 1)
    ADMIN_COMMAND_FILE = os.getenv("ADMIN_COMMAND_FILE", "logs/admin-command.json")
    ADMIN_COMMAND_TTL_SECONDS = max(int(os.getenv("ADMIN_COMMAND_TTL_SECONDS", 30)), 5)
    PROJECT_BRANCH = get_project_branch()
    PYTHON_VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    ENV = os.getenv("ENV", "development")
    DEBUG = get_bool_env("DEBUG", False)
    AUTO_CREATE_TABLES = get_bool_env("AUTO_CREATE_TABLES", True)

    # Logging
    LOG_FILE = os.getenv("LOG_FILE", "logs/app.log")
    LOG_DIR = os.getenv("LOG_DIR", "logs")
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
    DB_FALLBACK_ENABLED = get_bool_env("DB_FALLBACK_ENABLED", True)

    # Auth
    JWT_SECRET = os.getenv("JWT_SECRET", "change_me_before_public_deploy")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
    AUTH_RATE_LIMIT_WINDOW_SECONDS = max(int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)), 1)
    AUTH_LOGIN_RATE_LIMIT_ATTEMPTS = max(int(os.getenv("AUTH_LOGIN_RATE_LIMIT_ATTEMPTS", 5)), 1)
    AUTH_REGISTER_RATE_LIMIT_ATTEMPTS = max(int(os.getenv("AUTH_REGISTER_RATE_LIMIT_ATTEMPTS", 3)), 1)

    # DEV access seed
    DEV_SUPERUSER_ENABLED = get_bool_env("DEV_SUPERUSER_ENABLED", True)
    DEV_SUPERUSER_EMAIL = os.getenv("DEV_SUPERUSER_EMAIL", "supervisor@project403.local")
    DEV_SUPERUSER_HANDLE = os.getenv("DEV_SUPERUSER_HANDLE", "supervisor")
    DEV_SUPERUSER_FIRST_NAME = os.getenv("DEV_SUPERUSER_FIRST_NAME", "Supervisor")
    DEV_SUPERUSER_LAST_NAME = os.getenv("DEV_SUPERUSER_LAST_NAME", "")
    DEV_SUPERUSER_PASSWORD = os.getenv("DEV_SUPERUSER_PASSWORD", "Supervisor403")

    DEV_USER_ENABLED = get_bool_env("DEV_USER_ENABLED", True)
    DEV_USER_EMAIL = os.getenv("DEV_USER_EMAIL", "user@project403.local")
    DEV_USER_HANDLE = os.getenv("DEV_USER_HANDLE", "demo_user")
    DEV_USER_FIRST_NAME = os.getenv("DEV_USER_FIRST_NAME", "Demo")
    DEV_USER_LAST_NAME = os.getenv("DEV_USER_LAST_NAME", "User")
    DEV_USER_PASSWORD = os.getenv("DEV_USER_PASSWORD", "User403pass")

parameters = Parameters()

