#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

. "$ROOT_DIR/scripts/lib-env.sh"

load_env_file .env

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  printf '[webhook] TELEGRAM_BOT_TOKEN is required\n' >&2
  exit 1
fi

if [ -z "${TELEGRAM_WEBHOOK_URL:-}" ]; then
  printf '[webhook] TELEGRAM_WEBHOOK_URL is required\n' >&2
  exit 1
fi

if [ -z "${TELEGRAM_WEBHOOK_SECRET:-}" ]; then
  printf '[webhook] TELEGRAM_WEBHOOK_SECRET is required\n' >&2
  exit 1
fi

curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'content-type: application/json' \
  -d "{\"url\":\"${TELEGRAM_WEBHOOK_URL}\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\",\"edited_message\"]}"

printf '\n[webhook] Telegram webhook configured\n'
