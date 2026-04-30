from dotenv import load_dotenv
import subprocess
import os

load_dotenv()

def get_build_id():
    build_id = os.getenv("BUILD_ID")
    if build_id:
        return build_id

    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return "local"

class Parameters:
    # App
    APP_NAME = os.getenv("APP_NAME", "DEBUG_APP_NAME")
    VERSION = f"v {os.getenv('VERSION', '0.0.1')} build {get_build_id()}"
    ENV = os.getenv("ENV", "development")
    DEBUG = os.getenv("DEBUG", "False") == "True"

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))

    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5432/messenger_db",
    )

    # Auth
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

parameters = Parameters()

