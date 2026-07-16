#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

. "$ROOT_DIR/scripts/lib-env.sh"

STRICT=false
if [ "${1:-}" = "--strict" ]; then
  STRICT=true
fi

load_env_file .env

FAILED=0

pass() {
  printf '[pass] %s\n' "$1"
}

warn() {
  printf '[warn] %s\n' "$1"
  if [ "$STRICT" = true ]; then
    FAILED=1
  fi
}

require_env() {
  KEY="$1"
  VALUE="$(eval "printf '%s' \"\${$KEY:-}\"")"
  if [ -n "$VALUE" ]; then
    pass "$KEY is set"
  else
    warn "$KEY is missing"
  fi
}

require_env TELEGRAM_BOT_TOKEN
require_env TELEGRAM_WEBHOOK_SECRET
require_env TELEGRAM_WEBHOOK_URL
require_env ADMIN_TELEGRAM_USER_IDS
require_env OPENROUTER_API_KEY
require_env OPENROUTER_MODEL
require_env DATABASE_URL

case "${TELEGRAM_WEBHOOK_URL:-}" in
  https://*)
    pass "TELEGRAM_WEBHOOK_URL uses HTTPS"
    ;;
  "")
    warn "TELEGRAM_WEBHOOK_URL is empty"
    ;;
  *)
    warn "TELEGRAM_WEBHOOK_URL should be HTTPS"
    ;;
esac

case "${ADMIN_TELEGRAM_USER_IDS:-}" in
  *[!0-9,[:space:]]*)
    warn "ADMIN_TELEGRAM_USER_IDS should be comma-separated numeric IDs"
    ;;
  "")
    warn "ADMIN_TELEGRAM_USER_IDS is empty"
    ;;
  *)
    pass "ADMIN_TELEGRAM_USER_IDS format looks valid"
    ;;
esac

case "${TELEGRAM_TEST_CHAT_ID:-}" in
  "")
    warn "TELEGRAM_TEST_CHAT_ID is not set; group reachability check will be skipped"
    ;;
  -[0-9]*|[0-9]*)
    pass "TELEGRAM_TEST_CHAT_ID format looks valid"
    ;;
  *)
    warn "TELEGRAM_TEST_CHAT_ID should be a numeric chat ID"
    ;;
esac

if docker info >/dev/null 2>&1; then
  pass "Docker daemon is reachable"
else
  warn "Docker daemon is not reachable"
fi

if [ -n "${AI_DAILY_COST_LIMIT_USD:-}" ]; then
  pass "AI_DAILY_COST_LIMIT_USD is set"
else
  warn "AI_DAILY_COST_LIMIT_USD is not set; cost guardrail is disabled"
fi

if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  case "$ALERT_WEBHOOK_URL" in
    http://*|https://*) pass "ALERT_WEBHOOK_URL format looks valid" ;;
    *) warn "ALERT_WEBHOOK_URL should start with http:// or https://" ;;
  esac
else
  warn "ALERT_WEBHOOK_URL is not set; dead-letter alerts will only log"
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\nRuntime env validation failed in strict mode.\n' >&2
  exit 1
fi

printf '\nRuntime env validation finished.\n'
