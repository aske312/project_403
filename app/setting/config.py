from dotenv import load_dotenv
import subprocess
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
if not ENV_FILE.exists():
    raise RuntimeError("Settings file is missing. Create the project settings file before starting the app.")

load_dotenv(dotenv_path=ENV_FILE, override=True)

DEFAULT_JWT_SECRET = "change_me_before_public_deploy"
PRODUCTION_ENVIRONMENTS = {"prod", "production"}
DEV_ENVIRONMENTS = {"dev", "development", "local"}


def get_bool_env(name):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required settings parameter: {name}")

    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_str_env(name):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required settings parameter: {name}")
    return value.strip()


def get_optional_str_env(name, default=None):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def get_int_env(name):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required settings parameter: {name}")
    return int(value)


def get_list_env(name):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required settings parameter: {name}")

    return [item.strip() for item in value.split(",") if item.strip()]


def get_required_env(name):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required settings parameter: {name}")
    return value.strip()


def parse_yaml_scalar(value):
    token = value.strip()

    if token in {"true", "True", "TRUE"}:
        return True
    if token in {"false", "False", "FALSE"}:
        return False
    if token in {"null", "Null", "NULL", "~"}:
        return None

    if len(token) >= 2 and token[0] == token[-1] and token[0] in {'"', "'"}:
        return token[1:-1]

    if re.fullmatch(r"-?\d+", token):
        return int(token)
    if re.fullmatch(r"-?\d+\.\d+", token):
        return float(token)

    return token


def parse_simple_yaml(text, *, source_name):
    root = {}
    stack = [(-1, root)]

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.split("#", 1)[0].rstrip()
        if not line.strip():
            continue

        if "\t" in raw_line:
            raise RuntimeError(f"{source_name}:{line_number} uses tabs for indentation.")

        indent = len(line) - len(line.lstrip(" "))
        if indent % 2 != 0:
            raise RuntimeError(f"{source_name}:{line_number} must use two-space indentation.")

        while stack and indent <= stack[-1][0]:
            stack.pop()

        if not stack:
            raise RuntimeError(f"{source_name}:{line_number} has invalid indentation.")

        parent = stack[-1][1]
        key_value = line.strip()
        if ":" not in key_value:
            raise RuntimeError(f"{source_name}:{line_number} is missing a key separator.")

        key, raw_value = key_value.split(":", 1)
        key = key.strip()
        if not key:
            raise RuntimeError(f"{source_name}:{line_number} contains an empty key.")

        raw_value = raw_value.strip()
        if raw_value == "":
            node = {}
            parent[key] = node
            stack.append((indent, node))
            continue

        parent[key] = parse_yaml_scalar(raw_value)

    return root


def require_bool(mapping, key, *, source_name):
    if key not in mapping:
        raise RuntimeError(f"{source_name} is missing the '{key}' flag.")

    value = mapping[key]
    if not isinstance(value, bool):
        raise RuntimeError(f"{source_name} must store '{key}' as true/false.")

    return value


def normalize_environment_key(value):
    normalized = str(value or "").strip().lower()

    if normalized in {"dev", "development", "local"}:
        return "dev"
    if normalized in {"prod", "production"}:
        return "prod"

    return normalized


def read_feature_flags_config(path):
    feature_flags_path = (ENV_FILE.parent / path).resolve()

    if not feature_flags_path.exists():
        raise RuntimeError("Feature flag file is missing.")

    parsed = parse_simple_yaml(
        feature_flags_path.read_text(encoding="utf-8"),
        source_name=str(feature_flags_path),
    )

    features = parsed.get("features")
    if not isinstance(features, dict) or not features:
        raise RuntimeError("Feature flag file must contain a top-level 'features' mapping.")

    normalized_features = {}
    for feature_name, feature_config in features.items():
        feature_key = str(feature_name or "").strip()
        if not feature_key:
            raise RuntimeError("Feature flag file contains an empty feature name.")

        if not isinstance(feature_config, dict) or not feature_config:
            raise RuntimeError(f"Feature flag '{feature_key}' must define environment rules.")

        normalized_feature = {}
        for environment_name, environment_config in feature_config.items():
            environment_key = normalize_environment_key(environment_name)
            if environment_key not in {"dev", "prod"}:
                raise RuntimeError(
                    f"Feature flag '{feature_key}' uses unsupported environment '{environment_name}'."
                )

            if not isinstance(environment_config, dict):
                raise RuntimeError(
                    f"Feature flag '{feature_key}' environment '{environment_name}' must be a mapping."
                )

            normalized_feature[environment_key] = {
                "enabled": require_bool(
                    environment_config,
                    "enabled",
                    source_name=f"Feature flag '{feature_key}' environment '{environment_name}'",
                ),
                "anonymous": require_bool(
                    environment_config,
                    "anonymous",
                    source_name=f"Feature flag '{feature_key}' environment '{environment_name}'",
                ),
                "user": require_bool(
                    environment_config,
                    "user",
                    source_name=f"Feature flag '{feature_key}' environment '{environment_name}'",
                ),
                "admin": require_bool(
                    environment_config,
                    "admin",
                    source_name=f"Feature flag '{feature_key}' environment '{environment_name}'",
                ),
            }

        if "dev" not in normalized_feature or "prod" not in normalized_feature:
            raise RuntimeError(f"Feature flag '{feature_key}' must define both dev and prod rules.")

        normalized_features[feature_key] = normalized_feature

    return normalized_features


def build_database_url():
    driver = get_str_env("DATABASE_DRIVER")
    user = quote_plus(get_required_env("DB_USER"))
    password = quote_plus(get_required_env("DB_PASSWORD"))
    host = get_required_env("DB_HOST")
    port = get_required_env("DB_PORT")
    name = get_required_env("DB_NAME")
    return f"{driver}://{user}:{password}@{host}:{port}/{name}"


def build_redis_url():
    password = get_optional_str_env("REDIS_PASSWORD", "")
    host = get_str_env("REDIS_HOST")
    port = get_int_env("REDIS_PORT")
    db = get_int_env("REDIS_DB")

    if password:
        return f"redis://:{quote_plus(password)}@{host}:{port}/{db}"

    return f"redis://{host}:{port}/{db}"


def get_build_id():
    build_id = get_str_env("BUILD_ID")
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
    return get_str_env("PROJECT_BRANCH")


def is_production_environment(value):
    return str(value or "").strip().lower() in PRODUCTION_ENVIRONMENTS


def is_dev_environment_name(value):
    return str(value or "").strip().lower() in DEV_ENVIRONMENTS


def mode_debug_enabled(value):
    return not is_production_environment(value)


def mode_auto_create_tables_enabled(value):
    return not is_production_environment(value)


def validate_production_config(settings):
    if not is_production_environment(settings.ENVIRONMENTS):
        return

    errors = []

    if settings.DATABASE_URL.startswith("sqlite"):
        errors.append("Database connection must not use SQLite in production.")

    jwt_secret = settings.JWT_SECRET.strip()
    if jwt_secret == DEFAULT_JWT_SECRET:
        errors.append("JWT_SECRET must be changed from the development default.")
    if len(jwt_secret) < 32:
        errors.append("JWT_SECRET must be at least 32 characters in production.")

    if errors:
        details = "\n- ".join(errors)
        raise RuntimeError(f"Production configuration is not safe:\n- {details}")


class Parameters:
    # App
    APP_NAME = get_str_env("APP_NAME")
    APP_VERSION = get_str_env("VERSION")
    VERSION = f"v.{APP_VERSION} build {get_build_id()}"
    STARTUP_DURATION_MS = None
    DATABASE_STARTUP_DURATION_MS = None
    BUILD_DURATION_MS = (
        float(os.getenv("BUILD_DURATION_MS"))
        if os.getenv("BUILD_DURATION_MS")
        else None
    )
    RUNTIME_STATE_FILE = get_str_env(
        "RUNTIME_STATE_FILE"
    )
    RUNTIME_HEARTBEAT_SECONDS = max(
        get_int_env("RUNTIME_HEARTBEAT_SECONDS"),
        1,
    )
    ADMIN_COMMAND_FILE = get_str_env(
        "ADMIN_COMMAND_FILE"
    )
    ADMIN_COMMAND_TTL_SECONDS = max(
        get_int_env("ADMIN_COMMAND_TTL_SECONDS"),
        5,
    )
    PROJECT_BRANCH = get_project_branch()
    PYTHON_VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    ENVIRONMENTS = get_str_env("ENVIRONMENTS")
    DEBUG = mode_debug_enabled(ENVIRONMENTS)
    AUTO_CREATE_TABLES = mode_auto_create_tables_enabled(ENVIRONMENTS)
    FEATURE_FLAGS_FILE = get_str_env("FEATURE_FLAGS_FILE")
    FEATURE_FLAGS = read_feature_flags_config(FEATURE_FLAGS_FILE)

    # Logging
    LOG_FILE = get_str_env("LOG_FILE")
    LOG_DIR = get_str_env("LOG_DIR")
    LOG_MAX_BYTES = get_int_env("LOG_MAX_BYTES")
    LOG_BACKUP_COUNT = get_int_env("LOG_BACKUP_COUNT")

    # Server
    HOST = get_str_env("HOST")
    PORT = get_int_env("PORT")
    FRONTEND_HOST = get_str_env("FRONTEND_HOST")
    FRONTEND_PORT = get_int_env("FRONTEND_PORT")
    CORS_ORIGINS = get_list_env("CORS_ORIGINS")

    # Database
    DATABASE_URL = build_database_url()
    DB_FALLBACK_URL = get_str_env(
        "DB_FALLBACK_URL"
    )
    DB_FALLBACK_ENABLED = get_bool_env(
        "DB_FALLBACK_ENABLED"
    )
    REDIS_URL = get_optional_str_env("REDIS_URL") or build_redis_url()
    REDIS_RATE_LIMIT_PREFIX = get_str_env("REDIS_RATE_LIMIT_PREFIX")
    REDIS_RATE_LIMIT_KEY_TTL_SECONDS = max(
        get_int_env("REDIS_RATE_LIMIT_KEY_TTL_SECONDS"),
        1,
    )

    # Auth
    JWT_SECRET = get_str_env("JWT_SECRET")
    JWT_ALGORITHM = get_str_env("JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES = get_int_env(
        "ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    AUTH_RATE_LIMIT_WINDOW_SECONDS = max(
        get_int_env("AUTH_RATE_LIMIT_WINDOW_SECONDS"),
        1,
    )
    AUTH_LOGIN_RATE_LIMIT_ATTEMPTS = max(
        get_int_env("AUTH_LOGIN_RATE_LIMIT_ATTEMPTS"),
        1,
    )
    AUTH_REGISTER_RATE_LIMIT_ATTEMPTS = max(
        get_int_env("AUTH_REGISTER_RATE_LIMIT_ATTEMPTS"),
        1,
    )

    DEV_SUPERUSER_ENABLED = get_bool_env(
        "DEV_SUPERUSER_ENABLED"
    )
    DEV_SUPERUSER_EMAIL = get_str_env("DEV_SUPERUSER_EMAIL")
    DEV_SUPERUSER_HANDLE = get_str_env("DEV_SUPERUSER_HANDLE")
    DEV_SUPERUSER_FIRST_NAME = get_str_env("DEV_SUPERUSER_FIRST_NAME")
    DEV_SUPERUSER_LAST_NAME = get_optional_str_env("DEV_SUPERUSER_LAST_NAME", "")
    DEV_SUPERUSER_PASSWORD = get_str_env("DEV_SUPERUSER_PASSWORD")

    DEV_USER_ENABLED = get_bool_env(
        "DEV_USER_ENABLED"
    )
    DEV_USER_EMAIL = get_str_env("DEV_USER_EMAIL")
    DEV_USER_HANDLE = get_str_env("DEV_USER_HANDLE")
    DEV_USER_FIRST_NAME = get_str_env("DEV_USER_FIRST_NAME")
    DEV_USER_LAST_NAME = get_str_env("DEV_USER_LAST_NAME")
    DEV_USER_PASSWORD = get_str_env("DEV_USER_PASSWORD")

parameters = Parameters()
validate_production_config(parameters)

