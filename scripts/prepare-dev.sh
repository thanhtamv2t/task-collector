#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  printf '\n[prepare-dev] %s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[prepare-dev] Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

compose() {
  docker compose "$@"
}

log "Checking local tooling"
require_command node
require_command npm
require_command docker

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 22 ]; then
  printf '[prepare-dev] Node.js 22+ is required. Current version: %s\n' "$(node -v)" >&2
  exit 1
fi

if [ ! -f .env ]; then
  log "Creating .env from .env.example"
  cp .env.example .env
else
  log ".env already exists"
fi

log "Installing dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

log "Starting PostgreSQL"
compose up -d postgres

log "Waiting for PostgreSQL healthcheck"
POSTGRES_CONTAINER="$(compose ps -q postgres)"
i=0
while [ "$i" -lt 60 ]; do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$POSTGRES_CONTAINER")"
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$STATUS" != "healthy" ]; then
  printf '[prepare-dev] PostgreSQL did not become healthy. Current status: %s\n' "$STATUS" >&2
  compose logs postgres
  exit 1
fi

log "Running database migrations"
npm run db:migrate

log "Verifying project"
npm run build
npm test
npm run test:integration
npm run lint

log "Development environment is ready"
printf 'Next: set TELEGRAM_BOT_TOKEN and ADMIN_TELEGRAM_USER_IDS in .env, then run npm run start:dev\n'
