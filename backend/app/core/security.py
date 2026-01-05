"""
安全性相關功能
包含 JWT 驗證、API Key 驗證等
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# API Key Header
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# JWT 設定
ALGORITHM = "HS256"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """建立 JWT Token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.api_secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """驗證 JWT Token"""
    try:
        payload = jwt.decode(token, settings.api_secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的認證憑證",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    """驗證 API Key"""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 API Key",
        )
    if api_key != settings.api_secret_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無效的 API Key",
        )
    return api_key
