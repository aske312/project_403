from fastapi import APIRouter
from sqlalchemy import text
from app.db.models import Base
from app.db.session import engine, init_db

router = APIRouter()

@router.get("/api/db/check_connect")
async def check_connect():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            value = result.scalar()

        return {
            "status": "ok",
            "db_response": value
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@router.post("/api/db/init")
async def initialize_database():
    try:
        await init_db()

        return {
            "status": "ok",
            "tables": sorted(Base.metadata.tables.keys())
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
