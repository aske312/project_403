from fastapi import FastAPI, APIRouter
from app.setting.config import parameters as param
from app.api.db import router as api_db
from app.api.debug import router as api_debug
from fastapi.middleware.cors import CORSMiddleware

router = APIRouter()

app = FastAPI(
    title=param.APP_NAME,
    version=param.VERSION
)

app.include_router(api_debug)
app.include_router(api_db)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
