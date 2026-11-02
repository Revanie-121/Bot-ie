import os
import sys
import uuid
from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.responses import JSONResponse
from .config import settings
from .models import (
    CreateDownloadJobRequest,
    JwtTokenRequest,
    JwtTokenResponse,
)
from .auth import create_jwt_token, verify_jwt_token
from .services.metadata_provider import AmazonMusicMetadataAdapter, MetadataProviderError
from .services.downloader import validate_output_directory

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Local FastAPI + Async Telegram Polling + SQLAlchemy + LucidaDL Backend",
)

metadata_adapter = AmazonMusicMetadataAdapter()


def require_jwt_auth(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer JWT token")
    token = authorization.split("Bearer ", 1)[1]
    try:
        return verify_jwt_token(token)
    except ValueError as err:
        raise HTTPException(status_code=401, detail=str(err))


@app.get("/api/health")
async def get_health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.version,
        "bind": f"{settings.bind_host}:{settings.bind_port}",
    }


@app.get("/api/diagnostics")
async def get_diagnostics():
    lucida_bin = settings.resolve_lucidadl_binary()
    ffmpeg_bin = settings.resolve_ffmpeg_binary()
    writable = os.access(settings.download_dir, os.W_OK) if os.path.exists(settings.download_dir) else False
    return {
        "python_version": sys.version.split()[0],
        "bind_address": f"{settings.bind_host}:{settings.bind_port}",
        "lucidadl_binary": lucida_bin or "not_found",
        "ffmpeg_binary": ffmpeg_bin or "not_found",
        "download_dir": settings.download_dir,
        "download_dir_writable": writable,
        "metadata_provider_configured": metadata_adapter.is_configured(),
        "telegram_polling_enabled": settings.telegram_polling_enabled,
    }


@app.post("/api/auth/token", response_model=JwtTokenResponse)
async def issue_token(req: JwtTokenRequest):
    token = create_jwt_token(
        subject=req.username,
        role=req.role,
        telegram_chat_id=req.telegram_chat_id,
    )
    return JwtTokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@app.get("/api/search")
async def search_music(
    q: str = Query(..., min_length=1, max_length=200),
    type: str = Query(default="all", pattern="^(all|track|album)$"),
):
    try:
        results = await metadata_adapter.search_catalog(q, type)
        return {"query": q, "type": type, "results": results}
    except MetadataProviderError as err:
        return JSONResponse(
            status_code=503,
            content={"error": err.code, "message": err.message},
        )
