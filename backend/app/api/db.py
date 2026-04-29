from fastapi import APIRouter
from sqlalchemy import text
from backend.app.db.session import engine

router = APIRouter()

@router.get("/db-check")
async def db_check():
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