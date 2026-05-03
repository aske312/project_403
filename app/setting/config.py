from dotenv import load_dotenv
import json
import subprocess
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

load_dotenv()


def read_app_config():
    config_path = Path(__file__).resolve().parents[2] / "config" / "app.json"
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


APP_CONFIG = read_app_config()


def config_value(*path, default=None):
    value = APP_CONFIG
    for key in path:
        if not isinstance(value, dict):
            return default
        value = value.get(key)
        if value is None:
            return default
    return value


def get_bool_env(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_required_env(name):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value.strip()


def build_database_url():
    driver = config_value("database", "driver", default="postgresql+asyncpg")
    user = quote_plus(get_required_env("DB_USER"))
    password = quote_plus(get_required_env("DB_PASSWORD"))
    host = get_required_env("DB_HOST")
    port = get_required_env("DB_PORT")
    name = get_required_env("DB_NAME")
    return f"{driver}://{user}:{password}@{host}:{port}/{name}"


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
    APP_NAME = config_value("project", "defaultName", default="Project_403")
    VERSION = f"v {config_value('project', 'defaultVersion', default='0.0.1')} build {get_build_id()}"
    STARTUP_DURATION_MS = None
    DATABASE_STARTUP_DURATION_MS = None
    BUILD_DURATION_MS = (
        float(os.getenv("BUILD_DURATION_MS"))
        if os.getenv("BUILD_DURATION_MS")
        else None
    )
    RUNTIME_STATE_FILE = config_value("runtime", "stateFile", default="logs/runtime-state.json")
    RUNTIME_HEARTBEAT_SECONDS = max(int(config_value("runtime", "heartbeatSeconds", default=10)), 1)
    ADMIN_COMMAND_FILE = config_value("runtime", "adminCommandFile", default="logs/admin-command.json")
    ADMIN_COMMAND_TTL_SECONDS = max(int(config_value("runtime", "adminCommandTtlSeconds", default=30)), 5)
    PROJECT_BRANCH = get_project_branch()
    PYTHON_VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    ENV = config_value("project", "environment", default="development")
    DEBUG = bool(config_value("project", "debug", default=False))
    AUTO_CREATE_TABLES = bool(config_value("project", "autoCreateTables", default=True))

    # Logging
    LOG_FILE = config_value("logging", "file", default="logs/app.log")
    LOG_DIR = config_value("logging", "directory", default="logs")
    LOG_MAX_BYTES = int(config_value("logging", "maxBytes", default=1024 * 1024))
    LOG_BACKUP_COUNT = int(config_value("logging", "backupCount", default=3))

    # Server
    HOST = config_value("server", "host", default="0.0.0.0")
    PORT = int(config_value("server", "port", default=8000))
    CORS_ORIGINS = config_value("server", "corsOrigins", default=["http://localhost:5173", "http://127.0.0.1:5173"])

    # Database
    DATABASE_URL = build_database_url()
    DB_FALLBACK_URL = config_value("database", "fallbackUrl", default="sqlite+aiosqlite:///./local.db")
    DB_FALLBACK_ENABLED = bool(config_value("database", "fallbackEnabled", default=True))

    # Auth
    JWT_SECRET = os.getenv("JWT_SECRET", "change_me_before_public_deploy")
    JWT_ALGORITHM = config_value("auth", "jwtAlgorithm", default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(config_value("auth", "accessTokenExpireMinutes", default=60 * 24 * 30))
    AUTH_RATE_LIMIT_WINDOW_SECONDS = max(int(config_value("auth", "rateLimitWindowSeconds", default=60)), 1)
    AUTH_LOGIN_RATE_LIMIT_ATTEMPTS = max(int(config_value("auth", "loginRateLimitAttempts", default=5)), 1)
    AUTH_REGISTER_RATE_LIMIT_ATTEMPTS = max(int(config_value("auth", "registerRateLimitAttempts", default=3)), 1)

    # DEV access seed
    DEV_SUPERUSER_ENABLED = True
    DEV_SUPERUSER_EMAIL = "supervisor@project403.local"
    DEV_SUPERUSER_HANDLE = os.getenv("DEV_SUPERUSER_HANDLE", "supervisor")
    DEV_SUPERUSER_FIRST_NAME = "Supervisor"
    DEV_SUPERUSER_LAST_NAME = ""
    DEV_SUPERUSER_PASSWORD = os.getenv("DEV_SUPERUSER_PASSWORD", "Supervisor403")

    DEV_USER_ENABLED = True
    DEV_USER_EMAIL = "user@project403.local"
    DEV_USER_HANDLE = os.getenv("DEV_USER_HANDLE", "demo_user")
    DEV_USER_FIRST_NAME = "Demo"
    DEV_USER_LAST_NAME = "User"
    DEV_USER_PASSWORD = os.getenv("DEV_USER_PASSWORD", "User403pass")

parameters = Parameters()

