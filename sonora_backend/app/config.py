import os
import shutil
from dataclasses import dataclass, field
from typing import List


@dataclass
class Settings:
    app_name: str = "Sonora Local & Telegram LucidaDL Server"
    version: str = "1.4.0"
    bind_host: str = os.getenv("BIND_HOST", "127.0.0.1")
    bind_port: int = int(os.getenv("BIND_PORT", "8000"))

    # Database (PostgreSQL primary via SQLAlchemy; local SQLite fallback for Termux standalone)
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://sonora:sonora_pass@127.0.0.1:5432/sonora_db",
    )
    sqlite_fallback_path: str = os.getenv(
        "SQLITE_FALLBACK_PATH",
        os.path.join(os.path.dirname(__file__), "data", "sonora_jobs.db"),
    )

    # JWT Authentication
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-this-in-local-env-sonora-key")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))

    # Telegram Bot Async Polling
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_polling_enabled: bool = os.getenv("TELEGRAM_POLLING_ENABLED", "true").lower() == "true"
    telegram_poll_timeout: int = int(os.getenv("TELEGRAM_POLL_TIMEOUT", "25"))

    # LucidaDL CLI Executable & Concurrency
    lucidadl_executable: str = os.getenv("LUCIDADL_BIN", "")
    download_dir: str = os.getenv("DOWNLOAD_DIR", "/sdcard/Music")
    default_format: str = os.getenv("DEFAULT_FORMAT", "flac")
    max_concurrent_jobs: int = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
    job_timeout_seconds: int = int(os.getenv("JOB_TIMEOUT_SECONDS", "900"))

    # Amazon Music Metadata API (Requires valid local token/headers if configured)
    amazon_music_api_url: str = os.getenv("AMAZON_MUSIC_API_URL", "https://api.music.amazon.com/v1")
    amazon_music_access_token: str = os.getenv("AMAZON_MUSIC_ACCESS_TOKEN", "")
    amazon_music_device_id: str = os.getenv("AMAZON_MUSIC_DEVICE_ID", "")

    allowed_output_roots: List[str] = field(
        default_factory=lambda: [
            "/sdcard/Music",
            "/sdcard/Download",
            "/data/data/com.termux/files/home/Music",
            "/app/downloads",
        ]
    )
    supported_formats: List[str] = field(
        default_factory=lambda: ["flac", "mp3", "opus", "wav"]
    )

    def resolve_lucidadl_binary(self) -> str:
        if self.lucidadl_executable and os.path.isfile(self.lucidadl_executable):
            return self.lucidadl_executable
        for candidate in ("lucidadl", "lucida"):
            found = shutil.which(candidate)
            if found:
                return found
        return ""

    def resolve_ffmpeg_binary(self) -> str:
        return shutil.which("ffmpeg") or ""


settings = Settings()
