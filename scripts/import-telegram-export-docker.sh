#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ "$#" -gt 0 ]; then
  EXPORT_FILE="$1"
  shift
else
  EXPORT_FILE="result.json"
fi

if [ ! -f "$EXPORT_FILE" ]; then
  printf '[telegram-import] Export file not found: %s\n' "$EXPORT_FILE" >&2
  exit 1
fi

case "$EXPORT_FILE" in
  /*) EXPORT_PATH="$EXPORT_FILE" ;;
  *) EXPORT_PATH="$PWD/$EXPORT_FILE" ;;
esac

printf '[telegram-import] Rebuilding api image...\n'
docker compose build api

printf '[telegram-import] Importing %s inside Docker...\n' "$EXPORT_FILE"
docker compose run --rm \
  -v "$EXPORT_PATH:/app/result.json:ro" \
  api node scripts/import-telegram-desktop-export.js /app/result.json "$@"
