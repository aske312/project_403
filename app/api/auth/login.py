import logging
import re
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.rate_limit import enforce_rate_limit, make_rate_limit_key, reset_rate_limit
from app.db.models import User
from app.db.session import get_session
from app.setting.config import parameters as param

router = APIRouter()
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)
EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
HANDLE_RE = r"^@?[a-z0-9_]{3,64}$"


class LoginRequest(BaseModel):
    login: str | None = Field(default=None, min_length=3, max_length=255)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("login", "email")
    @classmethod
    def normalize_identifier(cls, value):
        if value is None:
            return None

        identifier = value.strip().lower()
        if re.fullmatch(EMAIL_RE, identifier) or re.fullmatch(HANDLE_RE, identifier):
            return identifier

        raise ValueError("Login must be a valid email or user tag.")


class UserResponse(BaseModel):
    id: int
    email: str
    handle: str
    tag: str
    first_name: str | None
    last_name: str | None
    name: str
    role: str
    is_super_admin: bool
    permissions: list[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def verify_password(password, password_hash):
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def make_user_response(user):
    permissions = ["super_admin"] if user.is_super_admin else []

    return UserResponse(
        id=user.id,
        email=user.email,
        handle=user.handle,
        tag=f"@{user.handle}",
        first_name=user.first_name,
        last_name=user.last_name,
        name=user.name,
        role=user.role or "user",
        is_super_admin=bool(user.is_super_admin),
        permissions=permissions,
    )


def create_access_token(user):
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=param.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "handle": user.handle,
        "exp": expires_at,
    }
    return jwt.encode(payload, param.JWT_SECRET, algorithm=param.JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_session),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    try:
        payload = jwt.decode(
            credentials.credentials,
            param.JWT_SECRET,
            algorithms=[param.JWT_ALGORITHM],
        )
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        logger.info("Auth rejected: invalid token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    user = await db.get(User, user_id)
    if not user:
        logger.info("Auth rejected: user not found id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    return user


@router.post("/api/auth/login")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    identifier = payload.login or payload.email
    if not identifier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Login is required.")

    rate_limit_key = make_rate_limit_key("login", request, identifier)
    enforce_rate_limit(
        rate_limit_key,
        limit=param.AUTH_LOGIN_RATE_LIMIT_ATTEMPTS,
        window_seconds=param.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many login attempts. Try again later.",
    )

    if re.fullmatch(EMAIL_RE, identifier):
        user = await db.scalar(select(User).where(User.email == identifier))
    else:
        handle = identifier.removeprefix("@")
        user = await db.scalar(select(User).where(User.handle == handle))

    if not user or not verify_password(payload.password, user.password_hash):
        logger.info("Login rejected: login=%s", identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login or password.")

    reset_rate_limit(rate_limit_key)
    logger.info("User logged in: id=%s email=%s", user.id, user.email)
    return TokenResponse(
        access_token=create_access_token(user),
        user=make_user_response(user),
    )


@router.get("/api/users/me")
async def get_profile(current_user: User = Depends(get_current_user)):
    logger.info("Profile requested: id=%s email=%s", current_user.id, current_user.email)
    return make_user_response(current_user)
