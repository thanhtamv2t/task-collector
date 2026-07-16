# Telegram Task Reporter

Telegram Group Task Collector & AI Daily Reporter, implemented from
`telegram-task-reporter-plan.md`.

Implemented MVP paths:

- `POST /webhooks/telegram`
- `GET /health`, `/health/live`, `/health/ready`
- PostgreSQL schema for groups, topics, users, messages, jobs, AI runs, tasks, task events, and reports
- Telegram commands: `/setup`, `/topics`, `/watch`, `/unwatch`, `/settings`, `/report`, `/report_today`, `/tasks`, `/done`, `/assign`, `/help`
- pg-boss extraction/report/retry/retention jobs
- OpenRouter structured extraction with task matching and report generation
- Docker Compose with API, worker, and PostgreSQL 17

## Local Setup

Fast path:

```bash
npm run prepare:dev
```

Manual path:

1. Install dependencies:

```bash
npm install
```

2. Fill `.env` values:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=
ADMIN_TELEGRAM_USER_IDS=123456789
```

You can leave `TELEGRAM_BOT_TOKEN` empty until the bot is ready. The app starts without it, but
command replies will be skipped.

3. Start PostgreSQL and the app:

```bash
docker compose up postgres
npm run db:migrate
npm run start:dev
```

Or run the full stack:

```bash
docker compose up --build
```

## Telegram Flow

1. Create a bot with BotFather and add it to a Telegram group.
2. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_TELEGRAM_USER_IDS`.
3. Configure Telegram webhook to point at:

```text
POST https://your-domain.example/webhooks/telegram
```

4. In the group, run:

```text
/setup
/watch
```

Messages in watched topics will then be stored with raw Telegram payloads and normalized metadata.

## Commands

`/setup` registers the current group.

`/topics` lists known topics and whether they are watched.

`/watch` enables collection for the current topic.

`/unwatch` pauses collection for the current topic.

`/settings` shows group configuration.

`/report` sends a report for the last six hours.

`/report_today` sends a report from the start of the configured timezone day.

`/tasks` lists open tasks in the current topic.

`/done <task-id>` manually marks a task as done.

`/assign <task-id> @username` assigns a task to a known Telegram user.

`/help` shows command help.

Only users in `ADMIN_TELEGRAM_USER_IDS` can run these commands.

## Verification

```bash
npm run build
npm test
```

Readiness checks PostgreSQL and reports whether Telegram/OpenRouter credentials are currently
configured.

## VPS Setup

On a VPS that already has Docker and Docker Compose:

```bash
npm run setup:vps
npm run telegram:webhook
```

The default production domain is `task.orokucode.com`. The script creates `.env` if needed,
generates local secrets when empty, requires external credentials before deploy, builds the
dashboard, starts PostgreSQL/API/worker, installs Nginx/Certbot when missing, configures HTTPS, and
serves the dashboard at:

```text
https://task.orokucode.com
```

Required values before running on the VPS:

```bash
TELEGRAM_BOT_TOKEN=
ADMIN_TELEGRAM_USER_IDS=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_ADMIN_LOGIN= # or GITHUB_ADMIN_ID=
LETSENCRYPT_EMAIL=
```

The script sets these production URLs automatically:

```bash
DASHBOARD_URL=https://task.orokucode.com
TELEGRAM_WEBHOOK_URL=https://task.orokucode.com/webhooks/telegram
GITHUB_OAUTH_CALLBACK_URL=https://task.orokucode.com/auth/github/callback
```

Use that GitHub callback URL in the GitHub OAuth app.

See [RUNBOOK.md](RUNBOOK.md) for backup, restore, health checks, and incident handling.

To run all local checks and print the remaining external runtime checklist:

```bash
npm run runtime:checklist
```

Validate environment readiness:

```bash
npm run runtime:validate
npm run runtime:validate:strict
```

Check Telegram bot token/webhook/group reachability:

```bash
npm run runtime:telegram-check
```

Check OpenRouter key/model JSON response:

```bash
npm run runtime:openrouter-check
```

Full runtime verification is documented in [RUNTIME_VERIFICATION.md](RUNTIME_VERIFICATION.md).

Replay local Telegram webhook fixtures against a running API:

```bash
npm run runtime:replay-webhook
```

The fixture set covers task creation, completion, progress, blocker, decision, unassigned task,
username changes, users without usernames, reply chains, edited messages, duplicate updates, and
non-task conversation.

Smoke test a running API:

```bash
npm run runtime:smoke-api
```

Production hardening included in this compose setup:

- non-root runtime container
- Docker JSON log rotation
- pg-boss retries and dead-letter queue
- scheduled retention job: raw payload scrub after 90 days, processed normalized messages after 180 days, AI raw responses after 30 days
- database backup/restore scripts
- AI daily cost guardrail when `AI_DAILY_COST_LIMIT_USD` is set
- dead-letter job alert webhook via `ALERT_WEBHOOK_URL`
- Nginx HTTPS reverse proxy template in `deploy/nginx.telegram-task-reporter.conf`

## Manual Jobs

Internal job endpoints use `x-admin-token` when `INTERNAL_ADMIN_TOKEN` is configured:

```bash
curl -X POST http://localhost:3000/internal/jobs/extract \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"periodStart":"2026-07-15T00:00:00.000Z","periodEnd":"2026-07-15T06:00:00.000Z"}'
```

Available endpoints:

- `POST /internal/jobs/extract`
- `POST /internal/jobs/report`
- `POST /internal/jobs/retry-failed`
- `POST /internal/jobs/retention`
- `GET /internal/jobs/:id`
- `POST /internal/groups/:id/reprocess`
- `DELETE /internal/groups/:id/data`
- `GET /internal/metrics`

To delete all stored data for a group, use the destructive internal endpoint with care:

```bash
curl -X DELETE http://localhost:3000/internal/groups/GROUP_UUID/data \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
```

Operational metrics are available from:

```bash
curl http://localhost:3000/internal/metrics \
  -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
```

## AI Extraction

Extraction jobs call OpenRouter only when both values are set:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Without those values, extraction jobs release locked messages back to `pending` so they can be
processed later. AI output is validated with Zod and persisted in `ai_runs`.

Validated AI events are applied to the task engine when confidence is high enough:

- `confidence >= AI_AUTO_APPLY_CONFIDENCE`: create/update task and record task event.
- `AI_REVIEW_CONFIDENCE <= confidence < AI_AUTO_APPLY_CONFIDENCE`: record event for review without changing a task.
- `confidence < AI_REVIEW_CONFIDENCE`: ignore.

## Telegram Reports

Admin commands:

- `/report` sends a report for the last six hours.
- `/report_today` sends a report from the start of the configured timezone day.
- `/tasks` lists open tasks in the current topic.

Reports use Telegram MarkdownV2 escaping and are split into multiple Telegram messages when they
are long.

## Dashboard

The management dashboard lives in `dashboard/` and follows the Vite + React + shadcn-admin style.

```bash
pnpm --dir dashboard install
npm run dashboard:dev
```

For local dashboard development, create a GitHub OAuth app with callback URL:

```text
http://127.0.0.1:5173/auth/github/callback
```

Then set these values in `.env`:

```bash
DASHBOARD_URL=http://127.0.0.1:5173
AUTH_SESSION_SECRET=<random-long-secret>
GITHUB_OAUTH_CLIENT_ID=<github-client-id>
GITHUB_OAUTH_CLIENT_SECRET=<github-client-secret>
GITHUB_OAUTH_CALLBACK_URL=http://127.0.0.1:5173/auth/github/callback
GITHUB_ADMIN_LOGIN=<your-github-username>
```

`GITHUB_ADMIN_ID` can be used instead of `GITHUB_ADMIN_LOGIN` if you prefer locking to GitHub's
numeric account id. Only the configured account can load metrics, groups, topics, tasks, reports,
messages, AI runs, and job batches.

## Integration Test

After PostgreSQL is running locally:

```bash
npm run test:integration
```

This test exercises the real Nest webhook endpoint against PostgreSQL:

- `/setup` registers the group.
- `/watch` enables a topic.
- A normal message is stored with raw payload.
- A duplicate Telegram update is ignored.
- Invalid webhook secrets return `401`.

## Migration Rollback

The bootstrap migration rollback plan is kept in:

```text
drizzle/0000_bootstrap_collector.down.sql
```
