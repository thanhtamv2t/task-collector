#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

printf '[process-pending] Rebuilding api image...\n'
docker compose build api

printf '[process-pending] Starting api and worker...\n'
docker compose up -d api worker

printf '[process-pending] Running pending-message processor inside api container...\n'
docker compose exec -T api node scripts/process-pending-messages.js
