#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=0

pass() {
  printf '[pass] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1"
  FAILED=1
}

sql_value() {
  docker compose exec -T postgres psql \
    -U telegram_reporter \
    -d telegram_reporter \
    -Atc "$1"
}

require_count() {
  LABEL="$1"
  QUERY="$2"
  MIN_COUNT="$3"
  if ! COUNT="$(sql_value "$QUERY" 2>/tmp/task-reporter-sql-error.txt)"; then
    fail "$LABEL query failed: $(cat /tmp/task-reporter-sql-error.txt)"
    return
  fi

  if [ "$COUNT" -ge "$MIN_COUNT" ]; then
    pass "$LABEL ($COUNT >= $MIN_COUNT)"
  else
    fail "$LABEL ($COUNT < $MIN_COUNT)"
  fi
}

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not reachable"
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  fail "postgres service is not running"
  exit 1
fi

require_table() {
  TABLE_NAME="$1"
  COUNT="$(sql_value "select count(*) from information_schema.tables where table_schema = 'public' and table_name = '${TABLE_NAME}';")"
  if [ "$COUNT" -eq 1 ]; then
    pass "table ${TABLE_NAME} exists"
  else
    fail "table ${TABLE_NAME} is missing; run npm run db:migrate"
  fi
}

for table in telegram_groups telegram_topics telegram_users messages ai_runs tasks task_events reports job_batches; do
  require_table "$table"
done

require_count "Telegram group was registered" "select count(*) from telegram_groups;" 1
require_count "Watched topic exists" "select count(*) from telegram_topics where is_monitored = true;" 1
require_count "Telegram user was upserted" "select count(*) from telegram_users where is_bot = false;" 1
require_count "Messages were collected" "select count(*) from messages;" 1
require_count "Messages have group/user linkage" "select count(*) from messages where group_id is not null and user_id is not null;" 1
require_count "No duplicate Telegram messages" "select case when count(*) = count(distinct group_id || ':' || telegram_message_id) then 1 else 0 end from messages;" 1
require_count "pg-boss schedules exist" "select count(*) from pgboss.schedule;" 1
require_count "AI produced completed runs" "select count(*) from ai_runs where status = 'completed';" 1
require_count "Task events have source messages and confidence" "select count(*) from task_events where jsonb_array_length(source_message_ids) > 0 and ai_confidence is not null;" 1
require_count "Tasks exist with confidence" "select count(*) from tasks where ai_confidence is not null;" 1
require_count "Reports were generated" "select count(*) from reports;" 1
require_count "Reports include topic/user sections" "select count(*) from reports where content like '%Theo topic%' and content like '%Theo user%';" 1
require_count "Reports were sent to Telegram" "select count(*) from reports where status = 'sent' and telegram_message_id is not null;" 1

if [ "$FAILED" -ne 0 ]; then
  printf '\nRuntime state verification failed.\n' >&2
  exit 1
fi

printf '\nRuntime state verification passed.\n'
