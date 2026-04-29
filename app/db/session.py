from sqlalchemy.ext.asyncio import create_async_engine
from app.setting.config import parameters as param

engine = create_async_engine(
    param.DATABASE_URL,
    echo=True,
    pool_pre_ping=True
)