"""Central configuration loaded from .env file via Pydantic Settings."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Core ---
    DRY_RUN: bool = True
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # --- Paths ---
    EVE_JSON_PATH: str = "/var/log/suricata/eve.json"
    WHITELIST_PATH: str = "/app/config/whitelist.txt"
    THRESHOLDS_PATH: str = "/app/config/thresholds.yaml"
    DATABASE_PATH: str = "/data/shield.db"
    AUDIT_LOG_PATH: str = "/logs/audit.log"

    # --- DeepSeek AI ---
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_TIMEOUT_SECONDS: int = 8
    AI_MAX_CONCURRENT_REQUESTS: int = 2
    AI_BLOCK_RISK_SCORE: int = 8

    # --- MikroTik ---
    MIKROTIK_HOST: str = "10.100.101.1"
    MIKROTIK_PORT: int = 22
    MIKROTIK_USER: str = "admin"
    MIKROTIK_PASSWORD: str = ""
    MIKROTIK_BLACKLIST_TIMEOUT: str = "7d"

    # --- ntopng ---
    NTOPNG_BASE_URL: str = "http://10.100.101.250:3000"
    NTOPNG_USER: str = "admin"
    NTOPNG_PASSWORD: str = ""

    # --- Auth ---
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    TOTP_ISSUER: str = "AI-Shield"

    # --- Retention ---
    RETENTION_ALERT_DAYS: int = 7
    RETENTION_AI_REPORT_DAYS: int = 30
    RETENTION_AUDIT_DAYS: int = 90
    PRUNE_INTERVAL_HOURS: int = 6

    # --- Telegram ---
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # --- Whitelist ---
    WHITELIST_CIDRS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.DATABASE_PATH}"


settings = Settings()
