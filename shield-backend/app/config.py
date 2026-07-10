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

    # --- Safety & Mitigation (Sections 2-4) ---
    MITIGATION_ENABLED: bool = True
    AUTO_BLOCK_ENABLED: bool = True
    PERMANENT_AUTO_BLOCK_ENABLED: bool = False
    FIRST_BLOCK_TIMEOUT: str = "1h"
    SECOND_BLOCK_TIMEOUT: str = "24h"
    REPEAT_BLOCK_TIMEOUT: str = "7d"

    # --- AI Budget & Rate Limits (Section 8) ---
    AI_ENABLED: bool = True
    AI_DAILY_REQUEST_LIMIT: int = 500
    AI_HOURLY_REQUEST_LIMIT: int = 100
    AI_CACHE_TTL_SECONDS: int = 3600
    AI_FAILURE_COOLDOWN_SECONDS: int = 300

    # --- Telegram Dedup (Section 35) ---
    TELEGRAM_MIN_RISK_SCORE: int = 8
    TELEGRAM_RATE_LIMIT_PER_MINUTE: int = 10
    TELEGRAM_DEDUP_WINDOW_SECONDS: int = 300

    # --- Database ---
    API_DEFAULT_PAGE_SIZE: int = 50
    API_MAX_PAGE_SIZE: int = 200
    API_MAX_QUERY_RANGE_DAYS: int = 30

    # --- EVE Tailer (Section 11) ---
    EVE_CHECKPOINT_PATH: str = "/data/eve-checkpoint.json"
    EVE_CHECKPOINT_INTERVAL_SECONDS: int = 5
    EVE_REPLAY_BYTES: int = 65536
    EVE_MAX_LINE_BYTES: int = 1048576

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
