#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

export BIND_HOST="${BIND_HOST:-127.0.0.1}"
export BIND_PORT="${BIND_PORT:-8000}"

echo "Starting Sonora Local Backend on http://${BIND_HOST}:${BIND_PORT} ..."
exec python3 -m uvicorn app.main:app --host "$BIND_HOST" --port "$BIND_PORT"
