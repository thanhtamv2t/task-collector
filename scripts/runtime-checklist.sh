#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

. "$ROOT_DIR/scripts/lib-env.sh"

load_env_file .env

printf '[runtime-checklist] Local verification\n'
npm run build
npm test
npm run lint

printf '\n[runtime-checklist] Runtime environment validation\n'
sh scripts/validate-runtime-env.sh

printf '\n[runtime-checklist] Docker/PostgreSQL verification\n'
if docker info >/dev/null 2>&1; then
  npm run prepare:dev
  npm run test:integration
  npm run runtime:smoke-api
  printf '\nRun npm run runtime:verify-state after sending real Telegram messages and reports.\n'
else
  printf 'SKIP: Docker daemon is not running.\n'
fi

printf '\n[runtime-checklist] External Telegram/OpenRouter checks\n'
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  printf 'TODO: Set TELEGRAM_BOT_TOKEN from BotFather.\n'
else
  npm run runtime:telegram-check || true
fi

if [ -z "${TELEGRAM_WEBHOOK_URL:-}" ]; then
  printf 'TODO: Set TELEGRAM_WEBHOOK_URL.\n'
fi

if [ -z "${ADMIN_TELEGRAM_USER_IDS:-}" ]; then
  printf 'TODO: Set ADMIN_TELEGRAM_USER_IDS.\n'
fi

if [ -z "${OPENROUTER_API_KEY:-}" ] || [ -z "${OPENROUTER_MODEL:-}" ]; then
  printf 'TODO: Set OPENROUTER_API_KEY and OPENROUTER_MODEL.\n'
else
  npm run runtime:openrouter-check || true
fi

printf '\nManual runtime flow to complete remaining plan checkboxes:\n'
printf '1. Create bot with BotFather and add it to a test Telegram group.\n'
printf '2. Configure privacy/admin permissions for the bot.\n'
printf '3. Run npm run telegram:webhook.\n'
printf '4. In Telegram: /setup, /watch, send task messages, /report_today.\n'
printf '5. Confirm messages, tasks, ai_runs, task_events, and reports in PostgreSQL.\n'
