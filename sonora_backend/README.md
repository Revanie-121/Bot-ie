# Sonora Local & Telegram LucidaDL Server (`sonora_backend`)

Modular Python FastAPI backend, asynchronous Telegram Bot Long-Polling worker, SQLAlchemy PostgreSQL/SQLite persistence layer, JWT session security, and direct `lucidadl` CLI execution engine.

## 1. Architecture Overview

```
Telegram Bot / Android App / Web Console
        │ (REST JSON + JWT Bearer + SSE/WebSocket)
        ▼
FastAPI Server (127.0.0.1:8000)
        ├── Metadata Adapter (Amazon Music ASIN & Canonical URL Validator)
        ├── Async Job Queue Manager (PostgreSQL via SQLAlchemy 2.0)
        ├── Telegram Async Polling Worker (getUpdates -> /search, /dl, /status, /cancel)
        └── LucidaDL Subprocess Runner (asyncio.create_subprocess_exec -> /sdcard/Music)
```

## 2. Canonical Amazon Music URL Contract

- **Track**: `https://music.amazon.com/tracks/{ASIN}` (10-character uppercase alphanumeric ASIN)
- **Album**: `https://music.amazon.com/albums/{ASIN}`
- Both `canonical_url` and original `source_url` are preserved on every job payload.

## 3. Running in Termux + Ubuntu PRoot

```bash
# 1. In Termux (host Android shell):
termux-setup-storage
proot-distro login ubuntu --bind /sdcard:/sdcard

# 2. Inside Ubuntu PRoot:
cd sonora_backend
chmod +x diagnose.sh run_backend.sh
./diagnose.sh

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Run unit tests:
python3 -m unittest discover -s tests

# 4. Start backend on 127.0.0.1:8000:
./run_backend.sh
```

## 4. Running via Docker Compose (PostgreSQL + FastAPI + Telegram Bot)

```bash
cd sonora_backend
docker compose up --build -d
docker compose logs -f sonora_backend
```
