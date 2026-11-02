#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo " SONORA LOCAL / LUCIDADL ENVIRONMENT DIAGNOSTIC SCRIPT"
echo "========================================================"
echo "Working Directory : $(pwd)"
echo "Python Executable : $(command -v python3 || echo 'NOT FOUND')"
echo "Python Version    : $(python3 --version 2>&1 || echo 'N/A')"
echo "Virtual Env       : ${VIRTUAL_ENV:-'None active'}"

LUCIDA_BIN="$(command -v lucidadl || command -v lucida || echo '')"
if [ -n "$LUCIDA_BIN" ]; then
  echo "LucidaDL Binary   : $LUCIDA_BIN"
  "$LUCIDA_BIN" --version 2>&1 || true
  echo "--- Track CLI Help ---"
  "$LUCIDA_BIN" track --help 2>&1 || true
  echo "--- Album CLI Help ---"
  "$LUCIDA_BIN" album --help 2>&1 || true
else
  echo "LucidaDL Binary   : NOT FOUND in PATH (Check LUCIDADL_BIN in .env)"
fi

echo "FFmpeg Binary     : $(command -v ffmpeg || echo 'NOT FOUND')"
TARGET_DIR="${DOWNLOAD_DIR:-/sdcard/Music}"
echo "Target Storage    : $TARGET_DIR"
if [ -d "$TARGET_DIR" ] && [ -w "$TARGET_DIR" ]; then
  echo "Storage Status    : WRITABLE (Android shared storage mounted)"
else
  echo "Storage Status    : NOT WRITABLE or NOT MOUNTED"
  echo "  -> In Termux, run: termux-setup-storage"
  echo "  -> In proot-distro login ubuntu, pass: --bind /sdcard:/sdcard"
fi
echo "========================================================"
