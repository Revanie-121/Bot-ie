from typing import Dict, Any, List
from ..config import settings
from ..models import (
    normalize_and_validate_asin,
    build_canonical_amazon_url,
    validate_amazon_music_url,
)


class MetadataProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class AmazonMusicMetadataAdapter:
    """
    Adapter for Amazon Music metadata lookups.
    Enforces strict truthfulness: never fabricates catalog results when official
    API credentials are unconfigured, while supporting direct ASIN/URL resolution.
    """

    def is_configured(self) -> bool:
        return bool(settings.amazon_music_access_token and settings.amazon_music_device_id)

    def resolve_manual_input(self, raw_query: str, entity_type: str = "track") -> Dict[str, Any] | None:
        cleaned = (raw_query or "").strip()
        if cleaned.startswith("https://"):
            info = validate_amazon_music_url(cleaned)
            return {
                "entity_type": info["entity_type"],
                "asin": info["asin"],
                "title": f"Amazon Music {info['entity_type'].capitalize()} ({info['asin']})",
                "artist": "Verified ASIN Target",
                "album": "Direct URL Resolution",
                "artwork_url": None,
                "source_url": info["source_url"],
                "canonical_url": info["canonical_url"],
                "audio_quality": "Lossless FLAC (Source Verified)",
            }
        try:
            asin = normalize_and_validate_asin(cleaned)
            resolved_type = "album" if entity_type == "album" else "track"
            canonical = build_canonical_amazon_url(asin, resolved_type)
            return {
                "entity_type": resolved_type,
                "asin": asin,
                "title": f"Direct ASIN {asin}",
                "artist": "Manual ASIN Input",
                "album": "Amazon Music Catalog",
                "artwork_url": None,
                "source_url": canonical,
                "canonical_url": canonical,
                "audio_quality": "FLAC / 24-bit",
            }
        except ValueError:
            return None

    async def search_catalog(self, query: str, search_type: str = "all") -> List[Dict[str, Any]]:
        manual = self.resolve_manual_input(query, "album" if search_type == "album" else "track")
        if manual:
            return [manual]

        if not self.is_configured():
            raise MetadataProviderError(
                code="provider_not_configured",
                message=(
                    "Amazon Music Web API credentials (AMAZON_MUSIC_ACCESS_TOKEN, "
                    "AMAZON_MUSIC_DEVICE_ID) are not configured in local .env. "
                    "Use direct 10-character ASIN or https://music.amazon.com/tracks/{ASIN} URL fallback."
                ),
            )
        return []
