#!/bin/sh
set -eu

CALLER_DIR="$(pwd)"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ "$#" -gt 0 ]; then
  EXPORT_FILE="$1"
  shift
else
  EXPORT_FILE="result.json"
fi

case "$EXPORT_FILE" in
  /*) EXPORT_PATH="$EXPORT_FILE" ;;
  *)
    if [ -f "$CALLER_DIR/$EXPORT_FILE" ]; then
      EXPORT_PATH="$CALLER_DIR/$EXPORT_FILE"
    else
      EXPORT_PATH="$ROOT_DIR/$EXPORT_FILE"
    fi
    ;;
esac

if [ ! -f "$EXPORT_PATH" ]; then
  printf '[telegram-import] Export file not found: %s\n' "$EXPORT_FILE" >&2
  printf '[telegram-import] Checked path: %s\n' "$EXPORT_PATH" >&2
  printf '[telegram-import] Run from: %s\n' "$CALLER_DIR" >&2
  exit 1
fi

cd "$ROOT_DIR"

printf '[telegram-import] Rebuilding api image...\n'
docker compose build api

printf '[telegram-import] Importing %s inside Docker...\n' "$EXPORT_FILE"
docker compose run --rm \
  -v "$EXPORT_PATH:/app/result.json:ro" \
  api node scripts/import-telegram-desktop-export.js /app/result.json "$@"
