#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

. "$ROOT_DIR/scripts/lib-env.sh"
load_env_file .env

WEBHOOK_URL="${LOCAL_WEBHOOK_URL:-http://localhost:3000/webhooks/telegram}"
SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"
FIXTURE_DIR="${1:-test/fixtures/telegram-runtime}"

if [ -z "$SECRET" ]; then
  printf '[replay-webhook] TELEGRAM_WEBHOOK_SECRET is required in .env\n' >&2
  exit 1
fi

if [ ! -d "$FIXTURE_DIR" ]; then
  printf '[replay-webhook] Fixture directory not found: %s\n' "$FIXTURE_DIR" >&2
  exit 1
fi

for fixture in "$FIXTURE_DIR"/*.json; do
  printf '[replay-webhook] POST %s\n' "$fixture"
  curl -fsS "$WEBHOOK_URL" \
    -H "content-type: application/json" \
    -H "x-telegram-bot-api-secret-token: $SECRET" \
    --data-binary "@$fixture"
  printf '\n'
done

printf '[replay-webhook] Done\n'
