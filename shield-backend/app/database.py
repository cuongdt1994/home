"""Async SQLAlchemy engine and session factory for SQLite."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    poolclass=NullPool,
    connect_args={"check_same_thread": False},
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_database() -> None:
    """Create all tables and enable WAL mode."""
    import logging
    import os

    logger = logging.getLogger(__name__)

    # Ensure parent directory exists
    db_dir = os.path.dirname(settings.DATABASE_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    # Enable WAL mode for better concurrent read performance
    import aiosqlite

    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=5000")

    from app.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialized with WAL mode")


async def close_database() -> None:
    """Dispose the database engine."""
    import logging

    logger = logging.getLogger(__name__)
    await engine.dispose()
    logger.info("Database connection closed")
