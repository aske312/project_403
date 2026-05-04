import logging
import re
import time
from pathlib import Path

import bcrypt
from sqlalchemy import event
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.models import Base, Chat, ChatMember, Message, User
from app.setting.config import parameters as param

logger = logging.getLogger(__name__)
db_sql_logger = logging.getLogger("app.db.sql")


def _shorten_sql(value, limit=1000):
    if value is None:
        return ""

    text_value = " ".join(str(value).split())
    if len(text_value) <= limit:
        return text_value

    return f"{text_value[: limit - 3]}..."


def _shorten_params(value, limit=1000):
    if value is None:
        return ""

    try:
        text_value = repr(value)
    except Exception:
        text_value = "<unrepr-able>"

    if len(text_value) <= limit:
        return text_value

    return f"{text_value[: limit - 3]}..."


def _configure_engine_logging(sync_engine):
    @event.listens_for(sync_engine, "connect")
    def _on_connect(dbapi_connection, connection_record):
        db_sql_logger.info(
            "CONNECT backend=%s url=%s",
            get_database_backend(),
            get_public_database_url(),
        )

    @event.listens_for(sync_engine, "before_cursor_execute")
    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        context._project403_query_started_at = time.perf_counter()
        db_sql_logger.info(
            "SQL START statement=%s params=%s executemany=%s",
            _shorten_sql(statement),
            _shorten_params(parameters),
            executemany,
        )

    @event.listens_for(sync_engine, "after_cursor_execute")
    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        started_at = getattr(context, "_project403_query_started_at", None)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 1) if started_at else 0.0
        db_sql_logger.info(
            "SQL END rows=%s duration=%.1fms",
            cursor.rowcount,
            duration_ms,
        )

    @event.listens_for(sync_engine, "handle_error")
    def _handle_error(exception_context):
        db_sql_logger.error(
            "SQL ERROR statement=%s params=%s original=%s",
            _shorten_sql(getattr(exception_context, "statement", None)),
            _shorten_params(getattr(exception_context, "parameters", None)),
            exception_context.original_exception,
        )


def make_engine(url):
    engine_kwargs = {
        "echo": False,
    }

    if not url.startswith("sqlite"):
        engine_kwargs["pool_pre_ping"] = True

    async_engine = create_async_engine(url, **engine_kwargs)
    _configure_engine_logging(async_engine.sync_engine)
    return async_engine


engine = make_engine(param.DATABASE_URL)
active_database_url = param.DATABASE_URL
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
FALLBACK_FEATURE_NAME = "sqlite_database_fallback"


def get_public_database_url():
    return make_url(active_database_url).render_as_string(hide_password=True)


def get_database_backend():
    return make_url(active_database_url).get_backend_name()


def is_database_fallback_enabled():
    feature_rules = param.FEATURE_FLAGS.get(FALLBACK_FEATURE_NAME, {})
    environment_key = "prod" if param.ENVIRONMENTS.strip().lower() in {"prod", "production"} else "dev"
    environment_rules = feature_rules.get(environment_key, {})

    return param.DB_FALLBACK_ENABLED and environment_rules.get("enabled", False)


def get_sqlite_database_path(url):
    parsed_url = make_url(url)
    if parsed_url.get_backend_name() != "sqlite":
        return None

    database = parsed_url.database
    if not database or database == ":memory:":
        return None

    return Path(database).expanduser()


def ensure_sqlite_database_file(url):
    sqlite_path = get_sqlite_database_path(url)
    if sqlite_path is None:
        return

    sqlite_path.parent.mkdir(parents=True, exist_ok=True)


ensure_sqlite_database_file(param.DATABASE_URL)


def fallback_database_exists():
    sqlite_path = get_sqlite_database_path(param.DB_FALLBACK_URL)
    if sqlite_path is None:
        return True

    return sqlite_path.exists() and sqlite_path.is_file()


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

    if not is_database_fallback_enabled():
        raise RuntimeError("Database fallback is disabled.")
    ensure_sqlite_database_file(param.DB_FALLBACK_URL)

    previous_engine = engine
    active_database_url = param.DB_FALLBACK_URL
    engine = make_engine(active_database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    await previous_engine.dispose()


async def check_database_connection():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def init_active_database(*, create_missing_tables):
    try:
        if create_missing_tables:
            await create_tables()
        else:
            await check_database_connection()
    except Exception as exc:
        if active_database_url == param.DB_FALLBACK_URL:
            raise

        logger.warning("Primary database is unavailable, trying fallback database: %s", exc)
        await use_fallback_database()
        if create_missing_tables:
            await create_tables()
        else:
            await check_database_connection()


def is_dev_environment():
    return param.ENVIRONMENTS.strip().lower() in {"dev", "development", "local"}


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
    if not enabled:
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


async def ensure_dev_direct_chat():
    if not is_dev_environment():
        return
    if not (param.DEV_SUPERUSER_ENABLED and param.DEV_USER_ENABLED):
        return

    async with SessionLocal() as db_session:
        supervisor = await db_session.scalar(
            select(User).where(User.email == param.DEV_SUPERUSER_EMAIL.strip().lower())
        )
        user = await db_session.scalar(
            select(User).where(User.email == param.DEV_USER_EMAIL.strip().lower())
        )
        if not supervisor or not user:
            return

        existing_result = await db_session.execute(
            select(Chat)
            .options(selectinload(Chat.members))
            .join(ChatMember)
            .where(ChatMember.user_id.in_([supervisor.id, user.id]))
        )
        for chat in existing_result.scalars().unique().all():
            member_ids = {member.user_id for member in chat.members}
            if member_ids == {supervisor.id, user.id}:
                logger.info("DEV direct chat already exists: id=%s", chat.id)
                return

        chat = Chat(title="DEV: supervisor ↔ user")
        db_session.add(chat)
        await db_session.flush()
        db_session.add_all([
            ChatMember(chat_id=chat.id, user_id=supervisor.id),
            ChatMember(chat_id=chat.id, user_id=user.id),
            Message(
                chat_id=chat.id,
                sender_id=supervisor.id,
                body="DEV чат готов: можно проверять обмен сообщениями между supervisor и user.",
            ),
        ])
        await db_session.commit()
        logger.info("DEV direct chat created: id=%s supervisor=%s user=%s", chat.id, supervisor.email, user.email)


async def init_db():
    await init_active_database(create_missing_tables=True)

    await ensure_dev_seed_users()
    await ensure_dev_direct_chat()


async def get_session():
    async with SessionLocal() as db_session:
        yield db_session
