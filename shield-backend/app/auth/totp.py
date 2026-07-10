"""TOTP (Time-based One-Time Password) utilities using pyotp."""

import pyotp

from app.config import settings


def generate_totp_secret() -> str:
    """Generate a new random TOTP secret."""
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code against a secret.

    Args:
        secret: The TOTP secret (base32).
        code: The 6-digit code to verify.

    Returns:
        True if the code is valid.
    """
    if not secret or not code:
        return False
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code)
    except Exception:
        return False


def get_current_totp_code(secret: str) -> str:
    """Get the current TOTP code for a secret (useful for debugging only)."""
    totp = pyotp.TOTP(secret)
    return totp.now()


def get_provisioning_uri(username: str, secret: str) -> str:
    """Generate a provisioning URI for QR code setup.

    The user scans this with Google Authenticator or similar.
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=settings.TOTP_ISSUER)
