#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/telegram_reporter_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

printf '[backup-db] Writing %s\n' "$BACKUP_FILE"
docker compose exec -T postgres pg_dump -U telegram_reporter -d telegram_reporter -Fc > "$BACKUP_FILE"
printf '[backup-db] Done\n'
