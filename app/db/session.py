from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.models import Base
from app.setting.config import parameters as param


def make_engine(url):
    engine_kwargs = {
        "echo": param.DEBUG,
    }

    if not url.startswith("sqlite"):
        engine_kwargs["pool_pre_ping"] = True

    return create_async_engine(url, **engine_kwargs)


engine = make_engine(param.DATABASE_URL)
active_database_url = param.DATABASE_URL


def get_public_database_url():
    return make_url(active_database_url).render_as_string(hide_password=True)


def get_database_backend():
    return make_url(active_database_url).get_backend_name()


async def create_tables():
    # create_all is intentionally non-destructive: existing DB files and tables are reused.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def use_fallback_database():
    global active_database_url, engine

    if not param.DB_FALLBACK_ENABLED:
        raise RuntimeError("Database fallback is disabled.")

    active_database_url = param.DB_FALLBACK_URL
    engine = make_engine(active_database_url)
    await create_tables()


async def init_db():
    try:
        await create_tables()
    except Exception:
        if active_database_url == param.DB_FALLBACK_URL:
            raise

        await use_fallback_database()
