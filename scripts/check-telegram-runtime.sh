#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

. "$ROOT_DIR/scripts/lib-env.sh"
load_env_file .env

FAILED=0

pass() {
  printf '[pass] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1"
  FAILED=1
}

telegram_api() {
  METHOD="$1"
  BODY="${2:-}"

  if [ -n "$BODY" ]; then
    curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${METHOD}" \
      -H 'content-type: application/json' \
      -d "$BODY"
  else
    curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${METHOD}"
  fi
}

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  fail "TELEGRAM_BOT_TOKEN is missing"
  exit 1
fi

if telegram_api getMe >/tmp/task-reporter-telegram-getme.json; then
  if grep -q '"ok":true' /tmp/task-reporter-telegram-getme.json; then
    pass "Telegram bot token is valid"
  else
    fail "Telegram getMe did not return ok=true"
    cat /tmp/task-reporter-telegram-getme.json
    printf '\n'
  fi
else
  fail "Telegram getMe request failed"
fi

if telegram_api getWebhookInfo >/tmp/task-reporter-telegram-webhook.json; then
  if grep -q '"ok":true' /tmp/task-reporter-telegram-webhook.json; then
    pass "Telegram webhook info is reachable"
  else
    fail "Telegram getWebhookInfo did not return ok=true"
  fi

  if [ -n "${TELEGRAM_WEBHOOK_URL:-}" ]; then
    if grep -q "\"url\":\"${TELEGRAM_WEBHOOK_URL}\"" /tmp/task-reporter-telegram-webhook.json; then
      pass "Telegram webhook URL matches TELEGRAM_WEBHOOK_URL"
    else
      fail "Telegram webhook URL does not match TELEGRAM_WEBHOOK_URL"
      cat /tmp/task-reporter-telegram-webhook.json
      printf '\n'
    fi
  fi
else
  fail "Telegram getWebhookInfo request failed"
fi

if [ -n "${TELEGRAM_TEST_CHAT_ID:-}" ]; then
  BODY="{\"chat_id\":\"${TELEGRAM_TEST_CHAT_ID}\"}"
  if telegram_api getChat "$BODY" >/tmp/task-reporter-telegram-chat.json; then
    if grep -q '"ok":true' /tmp/task-reporter-telegram-chat.json; then
      pass "Telegram test chat is reachable"
    else
      fail "Telegram getChat did not return ok=true"
    fi
  else
    fail "Telegram getChat request failed for TELEGRAM_TEST_CHAT_ID"
  fi
else
  printf '[warn] TELEGRAM_TEST_CHAT_ID is not set; skipping group reachability check.\n'
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\nTelegram runtime check failed.\n' >&2
  exit 1
fi

printf '\nTelegram runtime check passed.\n'
