from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(
    title = settings.APP_NAME,
    version = settings.VERSION
)

# ------------------- # HEALTH CHECK # -------------------
@app.get("/debug")
def health_check():
    return {
        "status": "ok",
        "service": "hello"
    }