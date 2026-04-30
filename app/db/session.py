import logging
import re

import bcrypt
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.models import Base, User
from app.setting.config import parameters as param

logger = logging.getLogger(__name__)


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
        await ensure_sqlite_column(conn, columns, "role", "VARCHAR(32)")
        await ensure_sqlite_column(conn, columns, "is_super_admin", "BOOLEAN")
        await conn.execute(
            text("UPDATE users SET handle = 'user' || id WHERE handle IS NULL OR handle = ''")
        )
        await conn.execute(
            text("UPDATE users SET first_name = name WHERE first_name IS NULL OR first_name = ''")
        )
        await conn.execute(text("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''"))
        await conn.execute(text("UPDATE users SET is_super_admin = 0 WHERE is_super_admin IS NULL"))
        await conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_handle ON users (handle)")
        )
        return

    if dialect == "postgresql":
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(40)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(40)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN"))
        await conn.execute(
            text("UPDATE users SET handle = 'user' || id::text WHERE handle IS NULL OR handle = ''")
        )
        await conn.execute(
            text("UPDATE users SET first_name = name WHERE first_name IS NULL OR first_name = ''")
        )
        await conn.execute(text("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''"))
        await conn.execute(
            text("UPDATE users SET is_super_admin = false WHERE is_super_admin IS NULL")
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


def is_dev_environment():
    return param.ENV.strip().lower() in {"dev", "development", "local"}


def hash_seed_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_seed_name(first_name, last_name):
    return " ".join([first_name, last_name or ""]).strip() or first_name or "User"


def normalize_seed_handle(value, fallback):
    handle = re.sub(r"[^a-z0-9_]+", "_", value.strip().lower().removeprefix("@"))
    handle = re.sub(r"_+", "_", handle).strip("_")
    return (handle or fallback)[:64]


async def get_available_seed_handle(db_session, requested_handle, email, suffix):
    handle = normalize_seed_handle(requested_handle, suffix)
    owner = await db_session.scalar(
        select(User).where(
            User.handle == handle,
            User.email != email,
        )
    )
    if not owner:
        return handle

    base = handle[:55].rstrip("_")
    for index in range(1, 100):
        candidate = f"{base}_{suffix}{index}"[:64]
        owner = await db_session.scalar(
            select(User).where(
                User.handle == candidate,
                User.email != email,
            )
        )
        if not owner:
            return candidate

    raise RuntimeError(f"Could not find free handle for seeded user {email}.")


async def ensure_seed_user(
    *,
    enabled,
    email,
    handle,
    first_name,
    last_name,
    password,
    role,
    is_super_admin,
    label,
):
    if not enabled or not is_dev_environment():
        return

    async with SessionLocal() as db_session:
        normalized_email = email.strip().lower()
        user = await db_session.scalar(select(User).where(User.email == normalized_email))
        seed_handle = await get_available_seed_handle(
            db_session,
            handle,
            normalized_email,
            role,
        )
        full_name = get_seed_name(first_name, last_name)

        if not user:
            user = User(
                email=normalized_email,
                handle=seed_handle,
                first_name=first_name,
                last_name=last_name or None,
                name=full_name,
                role=role,
                is_super_admin=is_super_admin,
                password_hash=hash_seed_password(password),
            )
            db_session.add(user)
        else:
            user.handle = seed_handle
            user.first_name = first_name
            user.last_name = last_name or None
            user.name = full_name
            user.role = role
            user.is_super_admin = is_super_admin
            user.password_hash = hash_seed_password(password)

        await db_session.commit()
        logger.info("DEV %s user ensured: email=%s handle=%s", label, user.email, user.handle)


async def ensure_dev_seed_users():
    await ensure_seed_user(
        enabled=param.DEV_SUPERUSER_ENABLED,
        email=param.DEV_SUPERUSER_EMAIL,
        handle=param.DEV_SUPERUSER_HANDLE,
        first_name=param.DEV_SUPERUSER_FIRST_NAME,
        last_name=param.DEV_SUPERUSER_LAST_NAME,
        password=param.DEV_SUPERUSER_PASSWORD,
        role="owner",
        is_super_admin=True,
        label="superuser",
    )
    await ensure_seed_user(
        enabled=param.DEV_USER_ENABLED,
        email=param.DEV_USER_EMAIL,
        handle=param.DEV_USER_HANDLE,
        first_name=param.DEV_USER_FIRST_NAME,
        last_name=param.DEV_USER_LAST_NAME,
        password=param.DEV_USER_PASSWORD,
        role="user",
        is_super_admin=False,
        label="regular",
    )


async def init_db():
    try:
        await create_tables()
    except Exception:
        if active_database_url == param.DB_FALLBACK_URL:
            raise

        await use_fallback_database()

    await ensure_dev_seed_users()


async def get_session():
    async with SessionLocal() as db_session:
        yield db_session
