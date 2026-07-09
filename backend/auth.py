"""TOTP 2FA Authentication for LAN Monitor Dashboard."""

import os
import secrets
from datetime import datetime, timedelta

import jwt
import pyotp
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from config import settings

# JWT config
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

# TOTP secret (saved to .env or auto-generated on first run)
TOTP_SECRET = os.environ.get("TOTP_SECRET", "")
if not TOTP_SECRET:
    TOTP_SECRET = pyotp.random_base32()
    # Print once so admin can save it
    print(f"\n{'='*60}")
    print(f"🔑 TOTP Secret: {TOTP_SECRET}")
    print(f"📱 Add this to Google Authenticator or any TOTP app")
    print(f"📋 QR URI: {pyotp.totp.TOTP(TOTP_SECRET).provisioning_uri(name='admin', issuer_name='LAN Monitor')}")
    print(f"{'='*60}\n")

totp = pyotp.TOTP(TOTP_SECRET)

security = HTTPBearer(auto_error=False)


class TOTPLoginRequest(BaseModel):
    code: str
    remember: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str = "admin"
    expires_in: int = TOKEN_EXPIRE_HOURS * 3600


class UserInfo(BaseModel):
    username: str
    authenticated: bool = True


class TOTPStatus(BaseModel):
    enabled: bool = True
    secret_hint: str = ""  # Last 4 chars of secret


def create_token(username: str = "admin") -> str:
    """Create JWT access token."""
    payload = {
        "sub": username,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Verify JWT token, return payload or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_totp(code: str) -> bool:
    """Verify a TOTP code."""
    try:
        return totp.verify(code, valid_window=1)  # Allow 1 step before/after
    except Exception:
        return False


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = None,
) -> UserInfo:
    """Extract and verify the current user from the Authorization header or cookie."""
    token = None

    # Try Bearer token first
    if credentials:
        token = credentials.credentials

    # Then try cookie
    if not token:
        token = request.cookies.get("access_token")
        if token and token.startswith("Bearer "):
            token = token[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — please login with 2FA code",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired — please login again",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserInfo(username=payload["sub"])
