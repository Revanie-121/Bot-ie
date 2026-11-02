import re
from urllib.parse import urlparse, parse_qs
from typing import List, Literal, Optional

try:
    from pydantic import BaseModel, Field, field_validator
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    class BaseModel:  # type: ignore
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
    def Field(default=None, **kwargs):  # type: ignore
        return default
    def field_validator(*args, **kwargs):  # type: ignore
        def decorator(fn):
            return fn
        return decorator

ASIN_PATTERN = re.compile(r"^[A-Z0-9]{10}$")

EntityType = Literal["track", "album"]
AudioFormat = Literal["flac", "mp3", "opus", "wav"]
JobStatus = Literal[
    "queued",
    "validating",
    "resolving",
    "downloading",
    "processing",
    "completed",
    "failed",
    "cancelled",
]


def normalize_and_validate_asin(raw_asin: str) -> str:
    cleaned = (raw_asin or "").strip().upper()
    if not ASIN_PATTERN.match(cleaned):
        raise ValueError("ASIN must be exactly 10 alphanumeric characters.")
    return cleaned


def build_canonical_amazon_url(asin: str, entity_type: EntityType) -> str:
    normalized = normalize_and_validate_asin(asin)
    segment = "albums" if entity_type == "album" else "tracks"
    return f"https://music.amazon.com/{segment}/{normalized}"


def validate_amazon_music_url(url: str) -> dict:
    parsed = urlparse((url or "").strip())
    if parsed.scheme != "https":
        raise ValueError("Only HTTPS URLs are permitted.")
    host = (parsed.hostname or "").lower()
    if host != "music.amazon.com" and not host.endswith(".music.amazon.com"):
        raise ValueError("Host must be music.amazon.com.")

    qs = parse_qs(parsed.query)
    if "trackAsin" in qs and qs["trackAsin"]:
        asin = normalize_and_validate_asin(qs["trackAsin"][0])
        return {
            "asin": asin,
            "entity_type": "track",
            "canonical_url": build_canonical_amazon_url(asin, "track"),
            "source_url": url.strip(),
        }

    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2 and parts[0].lower() in ("tracks", "albums"):
        entity_type: EntityType = "album" if parts[0].lower() == "albums" else "track"
        asin = normalize_and_validate_asin(parts[1])
        return {
            "asin": asin,
            "entity_type": entity_type,
            "canonical_url": build_canonical_amazon_url(asin, entity_type),
            "source_url": url.strip(),
        }

    raise ValueError("URL path must match /tracks/{ASIN} or /albums/{ASIN}.")


class JobMetadataPayload(BaseModel):
    title: str = Field(default="", min_length=1, max_length=512)
    artist: str = Field(default="", min_length=1, max_length=512)
    album: str = Field(default="Single", max_length=512)
    artwork_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    release_date: Optional[str] = None
    audio_quality: Optional[str] = None


class CreateDownloadJobRequest(BaseModel):
    schema_version: int = Field(default=1, ge=1, le=1)
    entity_type: EntityType = "track"
    asin: str = ""
    canonical_url: str = ""
    source_url: str = ""
    metadata: Optional[JobMetadataPayload] = None
    output_dir: str = Field(default="/sdcard/Music")
    requested_format: AudioFormat = Field(default="flac")

    @field_validator("asin")
    @classmethod
    def check_asin(cls, v: str) -> str:
        return normalize_and_validate_asin(v)

    @field_validator("canonical_url")
    @classmethod
    def check_canonical(cls, v: str) -> str:
        info = validate_amazon_music_url(v)
        return info["canonical_url"]

    @field_validator("source_url")
    @classmethod
    def check_source(cls, v: str) -> str:
        validate_amazon_music_url(v)
        return v.strip()


class DownloadJobResponse(BaseModel):
    job_id: str = ""
    entity_type: EntityType = "track"
    asin: str = ""
    canonical_url: str = ""
    source_url: str = ""
    metadata: Optional[JobMetadataPayload] = None
    status: JobStatus = "queued"
    progress: Optional[int] = None
    message: str = ""
    output_dir: str = "/sdcard/Music"
    requested_format: AudioFormat = "flac"
    output_files: List[str] = Field(default_factory=list)
    stdout_logs: str = ""
    stderr_logs: str = ""
    error_summary: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class JwtTokenRequest(BaseModel):
    username: str = ""
    role: str = "operator"
    telegram_chat_id: Optional[str] = None


class JwtTokenResponse(BaseModel):
    access_token: str = ""
    token_type: str = "bearer"
    expires_in: int = 7200
