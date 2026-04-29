from fastapi import FastAPI, APIRouter
from app.core.config import settings
from app.api.db import router as db_router
from fastapi.middleware.cors import CORSMiddleware

router = APIRouter()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION
)
app.include_router(db_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------- # HEALTH CHECK # -------------------
@app.get("/debug")
def health_check():
    return {
        "status": "ok",
        "service": "hello"
    }