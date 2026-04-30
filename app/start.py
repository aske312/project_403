from fastapi import FastAPI
from app.setting.config import parameters as param
from app.api.db import router as api_db
from app.api.debug import router as api_debug
from app.db.session import init_db
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title=param.APP_NAME,
    version=param.VERSION
)

app.include_router(api_debug)
app.include_router(api_db)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    if not param.AUTO_CREATE_TABLES:
        return

    try:
        await init_db()
    except Exception as exc:
        print(f"Database initialization skipped: {exc}")
