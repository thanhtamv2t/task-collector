#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ "$#" -ne 1 ]; then
  printf 'Usage: %s ./backups/file.dump\n' "$0" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  printf '[restore-db] Backup file not found: %s\n' "$BACKUP_FILE" >&2
  exit 1
fi

printf '[restore-db] Restoring %s\n' "$BACKUP_FILE"
docker compose exec -T postgres pg_restore \
  -U telegram_reporter \
  -d telegram_reporter \
  --clean \
  --if-exists \
  --no-owner < "$BACKUP_FILE"
printf '[restore-db] Done\n'
