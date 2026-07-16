# Operations Runbook

## Deploy

1. Point DNS `task.orokucode.com` to the VPS public IP.
2. Copy the repository to the VPS.
3. Fill `.env` with the required external credentials:

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

4. In the GitHub OAuth app, set callback URL:

```text
https://task.orokucode.com/auth/github/callback
```

5. Run:

```bash
npm run setup:vps
npm run telegram:webhook
```

The VPS setup script installs Nginx/Certbot when missing, builds the dashboard, serves it from
`/var/www/task.orokucode.com`, proxies API routes to Docker on `127.0.0.1:3000`, and requests an SSL
certificate for `task.orokucode.com`.

## Telegram Bot Setup

1. Open Telegram and message `@BotFather`.
2. Run `/newbot`, choose a display name and username, then copy the token into `TELEGRAM_BOT_TOKEN`.
3. Run `/setprivacy` for the bot and disable privacy if the bot must collect ordinary group messages.
4. Add the bot to the target group.
5. Promote the bot to admin if the group/topic configuration requires it.
6. Send one message from each admin user and copy their numeric Telegram IDs into `ADMIN_TELEGRAM_USER_IDS`.
7. In the group, run:

```text
/setup
/watch
/settings
```

For topic groups, run `/watch` in every topic that should be collected.

## Runtime Validation

Before the final end-to-end check:

```bash
npm run runtime:validate
```

Use strict mode in deployment automation:

```bash
npm run runtime:validate:strict
```

Then run:

```bash
npm run runtime:checklist
```

Smoke test a running API:

```bash
npm run runtime:smoke-api
```

Inspect operational counters:

```bash
curl http://localhost:3000/internal/metrics -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
```

Check Telegram bot token, webhook, and optional test group reachability:

```bash
npm run runtime:telegram-check
```

Check OpenRouter key/model:

```bash
npm run runtime:openrouter-check
```

For local webhook simulation without Telegram:

```bash
npm run runtime:replay-webhook
```

For Nginx HTTPS reverse proxy, adapt:

```text
deploy/nginx.telegram-task-reporter.conf
```

## Health

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
docker compose ps
docker compose logs -f api worker
```

## Backup

```bash
npm run db:backup
```

Backups are written to `./backups` by default. Override with:

```bash
BACKUP_DIR=/var/backups/telegram-reporter npm run db:backup
```

## Restore

```bash
docker compose up -d postgres
npm run db:restore -- ./backups/telegram_reporter_YYYYMMDDTHHMMSSZ.dump
```

## Migration Rollback

The first migration rollback plan is documented in:

```text
drizzle/0000_bootstrap_collector.down.sql
```

It drops the bootstrap tables in reverse dependency order and is intended for disposable
environments or deliberate rollback after backup.

## Manual Jobs

```bash
curl -X POST http://localhost:3000/internal/jobs/extract -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" -H "content-type: application/json" -d '{}'
curl -X POST http://localhost:3000/internal/jobs/report -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" -H "content-type: application/json" -d '{}'
curl -X POST http://localhost:3000/internal/jobs/retry-failed -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
curl -X POST http://localhost:3000/internal/jobs/retention -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
curl -X POST http://localhost:3000/internal/groups/GROUP_UUID/reprocess -H "x-admin-token: $INTERNAL_ADMIN_TOKEN" -H "content-type: application/json" -d '{}'
```

Retention defaults are controlled by `RAW_PAYLOAD_RETENTION_DAYS=90`,
`NORMALIZED_MESSAGE_RETENTION_DAYS=180`, and `AI_RAW_RESPONSE_RETENTION_DAYS=30`.

## Delete Group Data

This permanently deletes the group row and cascades group-scoped topics, messages, AI runs, tasks,
task events, and reports. Group-scoped job batch rows are deleted first.

```bash
curl -X DELETE http://localhost:3000/internal/groups/GROUP_UUID/data -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
```

## Common Incidents

### API readiness fails

Check PostgreSQL and pg-boss connectivity:

```bash
docker compose logs postgres api
docker compose restart api worker
```

### Telegram reports are not sent

Verify:

- `TELEGRAM_BOT_TOKEN` is set.
- The bot can send messages to the destination chat.
- Group `report_chat_id` is configured.

### Jobs repeatedly fail

Check worker logs and alerts. If `ALERT_WEBHOOK_URL` is configured, dead-letter jobs are posted
there as JSON.

```bash
docker compose logs worker
```

Then retry failed message processing:

```bash
curl -X POST http://localhost:3000/internal/jobs/retry-failed -H "x-admin-token: $INTERNAL_ADMIN_TOKEN"
```
