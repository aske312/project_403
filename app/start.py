from fastapi import FastAPI, APIRouter
from app.core.config import settings
from app.api.db import router as db_router

router = APIRouter()

app = FastAPI(
    title = settings.APP_NAME,
    version = settings.VERSION
)
app.include_router(db_router)

# ------------------- # HEALTH CHECK # -------------------
@app.get("/debug")
def health_check():
    return {
        "status": "ok",
        "service": "hello"
    }