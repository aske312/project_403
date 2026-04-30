from sqlalchemy.ext.asyncio import create_async_engine
from app.setting.config import parameters as param
from app.db.models import Base

engine = create_async_engine(
    param.DATABASE_URL,
    echo=param.DEBUG,
    pool_pre_ping=True
)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
