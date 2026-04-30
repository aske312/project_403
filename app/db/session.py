from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

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
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def get_public_database_url():
    return make_url(active_database_url).render_as_string(hide_password=True)


def get_database_backend():
    return make_url(active_database_url).get_backend_name()


async def create_tables():
    # create_all is intentionally non-destructive: existing DB files and tables are reused.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_user_handle_column(conn)


async def ensure_user_handle_column(conn):
    dialect = conn.dialect.name

    if dialect == "sqlite":
        columns_result = await conn.execute(text("PRAGMA table_info(users)"))
        columns = list(columns_result)
        has_handle = any(row[1] == "handle" for row in columns)
        if not has_handle:
            await conn.execute(text("ALTER TABLE users ADD COLUMN handle VARCHAR(64)"))

        await ensure_sqlite_column(conn, columns, "first_name", "VARCHAR(40)")
        await ensure_sqlite_column(conn, columns, "last_name", "VARCHAR(40)")
        await conn.execute(
            text("UPDATE users SET handle = 'user' || id WHERE handle IS NULL OR handle = ''")
        )
        await conn.execute(
            text("UPDATE users SET first_name = name WHERE first_name IS NULL OR first_name = ''")
        )
        await conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_handle ON users (handle)")
        )
        return

    if dialect == "postgresql":
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(40)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(40)"))
        await conn.execute(
            text("UPDATE users SET handle = 'user' || id::text WHERE handle IS NULL OR handle = ''")
        )
        await conn.execute(
            text("UPDATE users SET first_name = name WHERE first_name IS NULL OR first_name = ''")
        )
        await conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_handle ON users (handle)")
        )


async def ensure_sqlite_column(conn, columns, column_name, column_type):
    if not any(row[1] == column_name for row in columns):
        await conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))


async def use_fallback_database():
    global SessionLocal, active_database_url, engine

    if not param.DB_FALLBACK_ENABLED:
        raise RuntimeError("Database fallback is disabled.")

    active_database_url = param.DB_FALLBACK_URL
    engine = make_engine(active_database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    await create_tables()


async def init_db():
    try:
        await create_tables()
    except Exception:
        if active_database_url == param.DB_FALLBACK_URL:
            raise

        await use_fallback_database()


async def get_session():
    async with SessionLocal() as db_session:
        yield db_session
