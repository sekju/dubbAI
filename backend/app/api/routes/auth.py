from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.schemas.auth import LoginRequest, TokenPair, UserCreateRequest, UserPublic

router = APIRouter()
settings = get_settings()
password_hasher = PasswordHasher()
_users: dict[str, dict[str, str]] = {}


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreateRequest) -> UserPublic:
    if payload.email in _users:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user_id = str(uuid4())
    _users[payload.email] = {
        "id": user_id,
        "email": payload.email,
        "password_hash": password_hasher.hash(payload.password),
        "status": "pending_activation",
    }
    return UserPublic(id=user_id, email=payload.email, status="pending_activation")


@router.post("/activate/{email}", response_model=UserPublic)
async def activate_user(email: str) -> UserPublic:
    user = _users.get(email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user["status"] = "active"
    return UserPublic(id=user["id"], email=email, status="active")


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest) -> TokenPair:
    user = _users.get(payload.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    try:
        password_hasher.verify(user["password_hash"], payload.password)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials") from exc

    if user["status"] != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not activated")

    now = datetime.now(timezone.utc)
    access_token = jwt.encode(
        {"sub": user["id"], "email": payload.email, "exp": now + timedelta(minutes=settings.access_token_ttl_minutes)},
        settings.jwt_secret_key,
        algorithm="HS256",
    )
    refresh_token = jwt.encode(
        {"sub": user["id"], "email": payload.email, "exp": now + timedelta(days=settings.refresh_token_ttl_days)},
        settings.jwt_refresh_secret_key,
        algorithm="HS256",
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token, token_type="bearer")
