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

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  fail "OPENROUTER_API_KEY is missing"
  exit 1
fi

if [ -z "${OPENROUTER_MODEL:-}" ]; then
  fail "OPENROUTER_MODEL is missing"
  exit 1
fi

BASE_URL="${OPENROUTER_BASE_URL:-https://openrouter.ai/api/v1}"
APP_NAME="${OPENROUTER_APP_NAME:-telegram-task-reporter}"
SITE_URL="${OPENROUTER_SITE_URL:-}"

BODY="$(cat <<EOF
{
  "model": "${OPENROUTER_MODEL}",
  "messages": [
    {
      "role": "user",
      "content": "Return only this JSON object: {\"ok\":true}"
    }
  ],
  "response_format": {
    "type": "json_object"
  }
}
EOF
)"

if curl -fsS "${BASE_URL}/chat/completions" \
  -H "authorization: Bearer ${OPENROUTER_API_KEY}" \
  -H 'content-type: application/json' \
  -H "x-title: ${APP_NAME}" \
  -H "http-referer: ${SITE_URL}" \
  -d "$BODY" > /tmp/task-reporter-openrouter-check.json; then
  pass "OpenRouter chat completion request succeeded"
else
  fail "OpenRouter chat completion request failed"
fi

if grep -q '"choices"' /tmp/task-reporter-openrouter-check.json &&
  grep -q '"content"' /tmp/task-reporter-openrouter-check.json; then
  pass "OpenRouter response contains choices/message content"
else
  fail "OpenRouter response is missing choices/message content"
  cat /tmp/task-reporter-openrouter-check.json
  printf '\n'
fi

if grep -q '"usage"' /tmp/task-reporter-openrouter-check.json; then
  pass "OpenRouter response contains usage metadata"
else
  printf '[warn] OpenRouter response did not include usage metadata.\n'
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\nOpenRouter runtime check failed.\n' >&2
  exit 1
fi

printf '\nOpenRouter runtime check passed.\n'
