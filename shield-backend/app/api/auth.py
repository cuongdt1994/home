"""Auth API routes — login, TOTP setup, token management."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.auth.jwt import create_access_token, decode_token
from app.auth.password import verify_password, hash_password
from app.auth.totp import (
    generate_totp_secret,
    verify_totp,
    get_provisioning_uri,
)
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Request/Response schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    requires_totp_setup: bool = False
    totp_provisioning_uri: str | None = None


class SetupTOTPRequest(BaseModel):
    totp_code: str


class SetupTOTPResponse(BaseModel):
    secret: str
    provisioning_uri: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# --- Routes ---
@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with username + password + optional TOTP code.

    If the user hasn't set up TOTP, the response includes a provisioning URI.
    If TOTP is enabled but no code is provided, returns 401 with a hint.
    """
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # If user has TOTP enabled, verify the code
    if user.totp_enabled and user.totp_secret:
        if not body.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="TOTP code required",
            )
        if not verify_totp(user.totp_secret, body.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code",
            )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # Create JWT
    from app.config import settings
    token = create_access_token(data={"sub": str(user.id), "username": user.username})

    # If user doesn't have TOTP set up, provide provisioning URI
    # Only generate a new secret if one doesn't already exist for this user
    requires_setup = not user.totp_enabled
    provisioning_uri = None
    if requires_setup:
        if not user.totp_secret:
            user.totp_secret = generate_totp_secret()
            await db.commit()
        provisioning_uri = get_provisioning_uri(user.username, user.totp_secret)

    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        requires_totp_setup=requires_setup,
        totp_provisioning_uri=provisioning_uri,
    )


@router.post("/setup-totp", response_model=dict)
async def setup_totp(
    body: SetupTOTPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable TOTP for the current user by verifying a test code."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="No TOTP secret generated — login first")

    if not verify_totp(current_user.totp_secret, body.totp_code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code — try again")

    current_user.totp_enabled = True
    await db.commit()
    return {"status": "ok", "message": "TOTP enabled successfully"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"status": "ok", "message": "Password changed"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "is_admin": current_user.is_admin,
        "totp_enabled": current_user.totp_enabled,
        "last_login_at": current_user.last_login_at.isoformat() if current_user.last_login_at else None,
    }
