#!/usr/bin/env python3
"""Create or update the initial admin user for AI Shield.

Usage:
    python scripts/init_admin.py --username admin --password mypassword
    python scripts/init_admin.py --username admin --password mypassword --totp

If --totp is provided, a TOTP secret is generated and the provisioning URI
is printed. Scan it with Google Authenticator.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.password import hash_password
from app.auth.totp import generate_totp_secret, get_provisioning_uri
from app.database import async_session, init_database
from app.models.user import User
from sqlalchemy import select


async def create_admin(username: str, password: str, setup_totp: bool):
    await init_database()

    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        totp_secret = None
        if setup_totp:
            totp_secret = generate_totp_secret()

        if user:
            print(f"User '{username}' already exists — updating password")
            user.hashed_password = hash_password(password)
            if totp_secret:
                user.totp_secret = totp_secret
                user.totp_enabled = False
        else:
            print(f"Creating admin user: {username}")
            user = User(
                username=username,
                hashed_password=hash_password(password),
                totp_secret=totp_secret,
                totp_enabled=False,
                is_active=True,
                is_admin=True,
            )
            db.add(user)

        await db.commit()

    print(f"✓ Admin user '{username}' ready")

    if totp_secret:
        uri = get_provisioning_uri(username, totp_secret)
        print(f"\nTOTP Provisioning URI (scan with Google Authenticator):")
        print(f"  {uri}")
        print(f"\nOr manually enter secret: {totp_secret}")
        print(f"After scanning, log in to enable TOTP.")
    else:
        print("\nTOTP not configured. Run with --totp to set up two-factor authentication.")


def main():
    parser = argparse.ArgumentParser(description="Create or update an admin user")
    parser.add_argument("--username", "-u", required=True, help="Admin username")
    parser.add_argument("--password", "-p", required=True, help="Admin password")
    parser.add_argument("--totp", action="store_true", help="Generate TOTP secret")
    args = parser.parse_args()

    asyncio.run(create_admin(args.username, args.password, args.totp))


if __name__ == "__main__":
    main()
