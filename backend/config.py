"""Application configuration loaded from environment variables."""

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    # App
    app_name: str = "LAN Monitor"
    debug: bool = False
    cors_origins: list[str] = field(default_factory=lambda: [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ])

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/lan_monitor.db"

    # SSH: Suricata + ntopng Server
    suricata_server_host: str = "10.100.101.250"
    suricata_server_port: int = 22
    suricata_server_user: str = "dns"
    suricata_server_pass: str = "1"
    suricata_eve_path: str = "/var/log/suricata/eve.json"

    # ntopng (accessed directly on localhost, or host.docker.internal in Docker)
    ntopng_host: str = "127.0.0.1"
    ntopng_local_port: int = 3000
    ntopng_user: str = "admin"
    ntopng_pass: str = "Cuongdt@94"
    ntopng_poll_interval: int = 30

    # SSH: MikroTik Router
    mikrotik_host: str = "10.100.101.1"
    mikrotik_port: int = 22
    mikrotik_user: str = "cuongdt"
    mikrotik_pass: str = "123@123pP"

    # DeepSeek API
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"
    deepseek_analysis_threshold: int = 2  # severity >= 2 triggers AI

    # Polling
    device_discovery_interval: int = 300

    def __post_init__(self):
        # Override from env vars
        for key in self.__dataclass_fields__:
            env_val = os.environ.get(key.upper())
            if env_val is not None:
                if isinstance(getattr(self, key), int):
                    setattr(self, key, int(env_val))
                elif isinstance(getattr(self, key), list):
                    setattr(self, key, env_val.split(","))
                else:
                    setattr(self, key, env_val)


settings = Settings()
