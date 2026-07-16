# Runtime Verification

Use this after secrets are configured and Docker is running.

## 1. Validate Environment

```bash
npm run runtime:validate:strict
```

Required values:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_URL`
- `ADMIN_TELEGRAM_USER_IDS`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `DATABASE_URL`

Optional but recommended:

- `TELEGRAM_TEST_CHAT_ID`

## 2. Start Services

```bash
npm run prepare:dev
npm run telegram:webhook
npm run runtime:telegram-check
npm run runtime:openrouter-check
npm run runtime:smoke-api
```

`runtime:smoke-api` checks health, webhook auth rejection, internal job triggers, and internal
metrics.

## 3. Telegram Group Test

Before using a real Telegram group, you can replay local Telegram webhook fixtures against the
running API:

```bash
npm run runtime:replay-webhook
```

This posts `/setup`, `/watch`, normal messages, a duplicate update, and an edited message to
`http://localhost:3000/webhooks/telegram`. The fixture set also covers unassigned tasks, username
changes, users without usernames, reply chains, blockers, decisions, and non-task conversation.

In the test group:

```text
/setup
/watch
/settings
```

Send at least these messages in a watched topic:

```text
Alice will finish the Telegram collector test today.
Progress: collector test is halfway done.
Blocker: waiting for webhook DNS.
Decision: use Docker Compose for MVP deployment.
Done: collector test is complete.
```

Then run:

```text
/report_today
/tasks
```

## 4. Trigger Batch Jobs

```bash
curl -X POST http://localhost:3000/internal/jobs/extract \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'

curl -X POST http://localhost:3000/internal/jobs/report \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'

curl -X POST http://localhost:3000/internal/groups/GROUP_UUID/reprocess \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

## 5. Verify Database Evidence

```bash
npm run runtime:verify-state
```

This maps to the remaining plan checkboxes:

- bot collected messages from watched topics
- messages link to user/group/topic
- duplicates are not stored
- schedules exist
- AI produced JSON-backed `ai_runs`
- tasks/task events have source messages and confidence
- reports include user/topic sections and were sent to Telegram

The security requirement for group data deletion is exposed as:

```bash
curl -X DELETE http://localhost:3000/internal/groups/GROUP_UUID/data \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
```

Run it only against disposable test data or when intentionally removing a group.

## 6. Completion

Only after `runtime:verify-state` passes and the BotFather/group setup is done should the remaining
checkboxes in `telegram-task-reporter-plan.md` be marked complete.
