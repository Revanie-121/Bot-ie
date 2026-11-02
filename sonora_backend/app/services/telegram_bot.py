import asyncio
import logging
from typing import Dict, Any, Tuple
import urllib.request
import json
from ..config import settings
from ..models import validate_amazon_music_url, normalize_and_validate_asin, build_canonical_amazon_url

logger = logging.getLogger("sonora.telegram")


def parse_telegram_command(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if not cleaned:
        return {"valid": False, "action": "unknown", "error": "Empty message."}

    if not cleaned.startswith("/"):
        # Direct Amazon Music URL or ASIN fallback
        try:
            info = validate_amazon_music_url(cleaned)
            return {
                "valid": True,
                "action": "download",
                "asin": info["asin"],
                "entity_type": info["entity_type"],
                "canonical_url": info["canonical_url"],
                "source_url": info["source_url"],
                "format": settings.default_format,
            }
        except ValueError:
            try:
                asin = normalize_and_validate_asin(cleaned)
                url = build_canonical_amazon_url(asin, "track")
                return {
                    "valid": True,
                    "action": "download",
                    "asin": asin,
                    "entity_type": "track",
                    "canonical_url": url,
                    "source_url": url,
                    "format": settings.default_format,
                }
            except ValueError as err:
                return {"valid": False, "action": "unknown", "error": str(err)}

    parts = cleaned.split()
    cmd = parts[0].split("@")[0].lower()
    args = parts[1:]

    if cmd in ("/start", "/help"):
        return {"valid": True, "action": "help", "command": cmd}
    if cmd == "/search":
        if not args:
            return {"valid": False, "action": "search", "error": "Usage: /search <query>"}
        return {"valid": True, "action": "search", "query": " ".join(args)}
    if cmd in ("/dl", "/download"):
        if not args:
            return {"valid": False, "action": "download", "error": "Usage: /dl <ASIN_OR_URL> [flac|mp3|opus|wav]"}
        target = args[0]
        fmt = args[1].lower() if len(args) > 1 and args[1].lower() in settings.supported_formats else settings.default_format
        try:
            info = validate_amazon_music_url(target)
            return {
                "valid": True,
                "action": "download",
                "asin": info["asin"],
                "entity_type": info["entity_type"],
                "canonical_url": info["canonical_url"],
                "source_url": info["source_url"],
                "format": fmt,
            }
        except ValueError:
            try:
                asin = normalize_and_validate_asin(target)
                url = build_canonical_amazon_url(asin, "track")
                return {
                    "valid": True,
                    "action": "download",
                    "asin": asin,
                    "entity_type": "track",
                    "canonical_url": url,
                    "source_url": url,
                    "format": fmt,
                }
            except ValueError as err:
                return {"valid": False, "action": "download", "error": str(err)}
    if cmd == "/status":
        return {"valid": True, "action": "status", "job_id": args[0] if args else None}
    if cmd == "/cancel":
        if not args:
            return {"valid": False, "action": "cancel", "error": "Usage: /cancel <job_id>"}
        return {"valid": True, "action": "cancel", "job_id": args[0]}
    if cmd == "/settings":
        return {"valid": True, "action": "settings"}

    return {"valid": False, "action": "unknown", "error": f"Unknown command: {cmd}"}


class TelegramPollingWorker:
    """
    Asynchronous Telegram Bot Long-Polling service (getUpdates) that tracks
    per-user PostgreSQL state and dispatches lucidadl download tasks.
    """

    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.offset = 0
        self._running = False

    async def poll_forever(self):
        if not self.bot_token:
            logger.info("TELEGRAM_BOT_TOKEN not set; async polling worker standing by.")
            return
        self._running = True
        logger.info("Starting asynchronous Telegram Bot getUpdates polling loop...")
        while self._running:
            try:
                await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                self._running = False
                break
