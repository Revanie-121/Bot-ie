import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

Base = declarative_base()


class UserRecord(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(128), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False)
    telegram_chat_id = Column(String(64), nullable=True, index=True)
    role = Column(String(32), nullable=False, default="operator")
    preferred_format = Column(String(16), nullable=False, default="flac")
    output_dir = Column(String(512), nullable=False, default="/sdcard/Music")
    concurrency_limit = Column(Integer, nullable=False, default=2)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class DownloadJobRecord(Base):
    __tablename__ = "download_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_uid = Column(String(64), unique=True, nullable=False, index=True)
    user_uid = Column(String(128), nullable=False, index=True)
    entity_type = Column(String(16), nullable=False)  # 'track' | 'album'
    asin = Column(String(16), nullable=False, index=True)
    canonical_url = Column(String(512), nullable=False)
    source_url = Column(String(1024), nullable=False)
    title = Column(String(512), nullable=False)
    artist = Column(String(512), nullable=False)
    album = Column(String(512), nullable=False)
    artwork_url = Column(String(1024), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    release_date = Column(String(64), nullable=True)
    audio_quality = Column(String(128), nullable=True)
    output_dir = Column(String(512), nullable=False, default="/sdcard/Music")
    requested_format = Column(String(16), nullable=False, default="flac")
    status = Column(String(32), nullable=False, default="queued", index=True)
    progress = Column(Integer, nullable=True)
    message = Column(String(512), nullable=False, default="Queued")
    output_files = Column(Text, nullable=False, default="[]")
    stdout_logs = Column(Text, nullable=False, default="")
    stderr_logs = Column(Text, nullable=False, default="")
    error_summary = Column(Text, nullable=True)
    telegram_chat_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
    )


class BotEventRecord(Base):
    __tablename__ = "bot_events"

    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(String(128), nullable=False)
    telegram_username = Column(String(128), nullable=False)
    chat_id = Column(String(64), nullable=False, index=True)
    command = Column(String(64), nullable=False)
    payload = Column(Text, nullable=False)
    response_text = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="processed")
    latency_ms = Column(Integer, nullable=False, default=35)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ErrorLogRecord(Base):
    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(64), nullable=False, index=True)
    severity = Column(String(16), nullable=False, default="ERROR")
    error_code = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=False)
    job_uid = Column(String(64), nullable=True)
    resolved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def build_engine(db_url: str | None = None):
    url = db_url or settings.database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)
