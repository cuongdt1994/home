"""JWT token creation and validation using python-jose."""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt

from app.config import settings


def create_access_token(data: dict[str, Any], expires_minutes: Optional[int] = None) -> str:
    """Create a signed JWT access token.

    Args:
        data: Claims to encode in the token (must include 'sub').
        expires_minutes: Token lifetime in minutes. Uses JWT_EXPIRE_MINUTES if not set.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire_minutes = expires_minutes or settings.JWT_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT token.

    Returns:
        Token payload dict, or None if invalid/expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None
