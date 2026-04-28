from dotenv import load_dotenv
import subprocess
import os

load_dotenv()

class Settings:

    # App
    APP_NAME = os.getenv("APP_NAME", "DEBUG_APP_NAME")
    VERSION = ("v " + os.getenv("VERSION", "0.0.1")
               + " build: " + subprocess.check_output(["git", "rev-parse", "--short", "HEAD"]).decode().strip())
    ENV = os.getenv("ENV", "development")
    DEBUG = os.getenv("DEBUG", "False") == "True"

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")

    # Auth
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

settings = Settings()