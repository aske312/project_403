import logging
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.login import TokenResponse, create_access_token, make_user_response
from app.api.auth.rate_limit import enforce_rate_limit, make_rate_limit_key, reset_rate_limit
from app.db.models import User
from app.db.session import get_session
from app.passwords import MAX_BCRYPT_PASSWORD_BYTES, hash_password
from app.runtime_state import mark_user_online
from app.setting.config import parameters as param

router = APIRouter()
logger = logging.getLogger(__name__)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
NAME_RE = re.compile(r"^[A-Za-z\u0400-\u04FF-]{1,40}$")
PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z\u0400-\u04FF])(?=.*\d).{8,72}$")


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    first_name: str = Field(min_length=1, max_length=40)
    last_name: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        email = value.strip().lower()
        if not EMAIL_RE.fullmatch(email):
            raise ValueError("Email format is invalid.")
        return email

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, value):
        name = value.strip()
        if not NAME_RE.fullmatch(name):
            raise ValueError("First name can contain only letters and hyphen, up to 40 characters.")
        return name

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, value):
        if value is None or value.strip() == "":
            return None

        last_name = value.strip()
        if not NAME_RE.fullmatch(last_name):
            raise ValueError("Last name can contain only letters and hyphen, up to 40 characters.")
        return last_name

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if not PASSWORD_RE.fullmatch(value):
            raise ValueError("Password must be 8-72 characters and contain at least one letter and one digit.")
        if len(value.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
            raise ValueError(f"Password must be at most {MAX_BCRYPT_PASSWORD_BYTES} bytes.")

        return value


def normalize_handle_seed(value):
    seed = re.sub(r"[^a-z0-9_]+", "_", value.strip().lower())
    seed = re.sub(r"_+", "_", seed).strip("_")
    if not seed:
        return "user"
    return seed[:28]


async def generate_user_handle(db: AsyncSession, name, email):
    email_seed = email.split("@", 1)[0]
    base = normalize_handle_seed(name) if name else normalize_handle_seed(email_seed)
    if base == "user":
        base = normalize_handle_seed(email_seed)

    for _ in range(12):
        suffix = secrets.token_hex(3)
        handle = f"{base}_{suffix}"[:64]
        existing_user = await db.scalar(select(User).where(User.handle == handle))
        if not existing_user:
            return handle

    return f"user_{secrets.token_hex(8)}"


@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    email = payload.email
    rate_limit_key = make_rate_limit_key("register", request, email)
    await enforce_rate_limit(
        rate_limit_key,
        limit=param.AUTH_REGISTER_RATE_LIMIT_ATTEMPTS,
        window_seconds=param.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many registration attempts. Try again later.",
    )

    existing_user = await db.scalar(select(User).where(User.email == email))

    if existing_user:
        logger.info("Registration rejected: email already exists: %s", email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists.",
        )

    full_name = " ".join([payload.first_name, payload.last_name or ""]).strip()
    user = User(
        email=email,
        handle=await generate_user_handle(db, full_name, email),
        first_name=payload.first_name,
        last_name=payload.last_name,
        name=full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await reset_rate_limit(rate_limit_key)
    mark_user_online(user.id)
    logger.info("User registered: id=%s email=%s handle=%s", user.id, user.email, user.handle)
    return TokenResponse(
        access_token=create_access_token(user),
        user=make_user_response(user),
    )
