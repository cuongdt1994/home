"""2FA Authentication API routes."""

from fastapi import APIRouter, HTTPException, Response, Depends

from auth import (
    create_token, verify_totp, get_current_user,
    TOTPLoginRequest, LoginResponse, UserInfo, TOTPStatus, TOTP_SECRET,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status", response_model=TOTPStatus)
async def auth_status():
    """Check if 2FA is enabled and show secret hint."""
    return TOTPStatus(
        enabled=True,
        secret_hint=TOTP_SECRET[-4:] if len(TOTP_SECRET) > 4 else "****"
    )


@router.post("/login", response_model=LoginResponse)
async def login(body: TOTPLoginRequest, response: Response):
    """Login with a 6-digit TOTP code from your authenticator app."""
    if not body.code or len(body.code) < 4:
        raise HTTPException(status_code=400, detail="Please enter a valid 2FA code")

    if not verify_totp(body.code):
        raise HTTPException(
            status_code=401,
            detail="Invalid 2FA code. Make sure your authenticator app is synced."
        )

    token = create_token()

    # Set cookie
    max_age = 86400 * 30 if body.remember else 86400
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        max_age=max_age,
        samesite="lax",
        secure=False,
    )

    return LoginResponse(access_token=token)


@router.post("/logout")
async def logout(response: Response):
    """Clear auth cookie."""
    response.delete_cookie("access_token")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserInfo)
async def get_me(user: UserInfo = Depends(get_current_user)):
    """Get current authenticated user info."""
    return user


@router.get("/secret")
async def get_secret_info(user: UserInfo = Depends(get_current_user)):
    """Get TOTP secret info for setup (requires existing auth)."""
    import pyotp as pt
    uri = pt.totp.TOTP(TOTP_SECRET).provisioning_uri(
        name='admin',
        issuer_name='LAN Monitor'
    )
    return {
        "secret": TOTP_SECRET,
        "qr_uri": uri,
        "hint": "Add this to Google Authenticator, Authy, or any TOTP app",
    }


@router.post("/verify")
async def verify_code(code: str):
    """Verify a TOTP code is valid (for testing/setup)."""
    from auth import verify_totp as vt
    is_valid = vt(code)
    return {"valid": is_valid}
