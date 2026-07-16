#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

. "$ROOT_DIR/scripts/lib-env.sh"
load_env_file .env

API_URL="${LOCAL_API_URL:-http://localhost:3000}"
FAILED=0

pass() {
  printf '[pass] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1"
  FAILED=1
}

status_code() {
  METHOD="$1"
  URL="$2"
  BODY="${3:-}"
  TOKEN_HEADER="${4:-}"

  if [ -n "$BODY" ]; then
    curl -sS -o /tmp/task-reporter-smoke-body.txt -w '%{http_code}' \
      -X "$METHOD" "$URL" \
      -H 'content-type: application/json' \
      ${TOKEN_HEADER:+-H "$TOKEN_HEADER"} \
      -d "$BODY"
  else
    curl -sS -o /tmp/task-reporter-smoke-body.txt -w '%{http_code}' \
      -X "$METHOD" "$URL" \
      ${TOKEN_HEADER:+-H "$TOKEN_HEADER"}
  fi
}

expect_status() {
  LABEL="$1"
  EXPECTED="$2"
  METHOD="$3"
  URL="$4"
  BODY="${5:-}"
  HEADER="${6:-}"

  STATUS="$(status_code "$METHOD" "$URL" "$BODY" "$HEADER")"
  if [ "$STATUS" = "$EXPECTED" ]; then
    pass "$LABEL"
  else
    fail "$LABEL expected $EXPECTED got $STATUS"
    printf 'Response body:\n'
    cat /tmp/task-reporter-smoke-body.txt
    printf '\n'
  fi
}

expect_status "health endpoint" "200" GET "$API_URL/health"
expect_status "liveness endpoint" "200" GET "$API_URL/health/live"
expect_status "readiness endpoint" "200" GET "$API_URL/health/ready"
expect_status "webhook rejects invalid secret" "401" POST "$API_URL/webhooks/telegram" '{"update_id":1}' 'x-telegram-bot-api-secret-token: invalid'

if [ -n "${INTERNAL_ADMIN_TOKEN:-}" ]; then
  expect_status "internal extract accepts admin token" "201" POST "$API_URL/internal/jobs/extract" '{}' "x-admin-token: $INTERNAL_ADMIN_TOKEN"
  expect_status "internal group reprocess accepts admin token" "201" POST "$API_URL/internal/groups/smoke-group/reprocess" '{}' "x-admin-token: $INTERNAL_ADMIN_TOKEN"
  expect_status "internal metrics accepts admin token" "200" GET "$API_URL/internal/metrics" '' "x-admin-token: $INTERNAL_ADMIN_TOKEN"
else
  printf '[warn] INTERNAL_ADMIN_TOKEN is empty; skipping internal endpoint auth smoke.\n'
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\nAPI smoke verification failed.\n' >&2
  exit 1
fi

printf '\nAPI smoke verification passed.\n'
