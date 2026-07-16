# Task Roadmap

## Working Rule

- Read this file at the start of every continuation before making changes.
- Update `Current State`, `Next Up`, and the checklist whenever a milestone changes.
- Keep this file short enough to scan in under one minute.

## Current State

- Code-level implementation for all planning milestones is complete.
- Remaining unchecked items in `telegram-task-reporter-plan.md` require real Telegram/OpenRouter/Docker runtime verification.
- Milestone 0 bootstrap is implemented.
- Milestone 1 collector foundation is implemented.
- `.env` and `.env.example` exist with Telegram/OpenRouter keys intentionally empty.
- Development and VPS setup scripts exist:
  - `npm run prepare:dev`
  - `npm run setup:vps`
- Milestone 2 job queue, scheduler, retries, and worker handlers are implemented.
- Milestone 3 AI extraction, token cost estimation, and guardrails are implemented.
- Milestone 4 task engine core is implemented.
- Milestone 5 report generator and Telegram commands are implemented.
- Milestone 6 production hardening is implemented in code/scripts/docs; runtime verification still needs Docker and VPS secrets.
- Verified commands:
  - `npm run build`
  - `npm test` (33 tests)
  - `npm run lint`
  - `npm run runtime:validate` (passes with expected warnings while secrets/Docker are absent)

## Done

- [x] NestJS project scaffold.
- [x] TypeScript strict mode.
- [x] ESLint and Prettier config.
- [x] Environment validation with Zod.
- [x] Pino structured logging.
- [x] Dockerfile and Docker Compose.
- [x] PostgreSQL 17 service config.
- [x] Drizzle config and first migration.
- [x] Rollback plan for first migration.
- [x] Tables: `telegram_groups`, `telegram_topics`, `telegram_users`, `messages`.
- [x] Health endpoints: `/health`, `/health/live`, `/health/ready`.
- [x] Telegram webhook endpoint: `POST /webhooks/telegram`.
- [x] Telegram webhook secret validation.
- [x] Telegram update parser for text, captions, replies, and edited messages.
- [x] Collector service with group/topic whitelist behavior.
- [x] Upsert group, topic, and user.
- [x] Save raw payload and normalized message.
- [x] Duplicate message guard.
- [x] Ignore bot messages.
- [x] Admin commands: `/setup`, `/topics`, `/watch`, `/unwatch`.
- [x] Basic parser and env validation tests.
- [x] README local setup notes.
- [x] Development prepare script.
- [x] VPS auto-setup script for Docker-based deployment.
- [x] Integration test script for webhook -> PostgreSQL.
- [x] pg-boss service and queue creation.
- [x] Scheduler service for configured cron schedules.
- [x] Extraction/report/retry job handlers.
- [x] Internal manual job trigger endpoints.
- [x] Internal group reprocess endpoint.
- [x] Internal group data deletion endpoint.
- [x] Batch key table for job idempotency.
- [x] Pending message lock to `processing` for extraction batches.
- [x] `ai_runs` table and AI run persistence.
- [x] OpenRouter client with model/fallback config.
- [x] Extraction prompt v1 and Zod output schema.
- [x] Message chunking for extraction batches.
- [x] Extraction job invokes AI extractor when OpenRouter is configured.
- [x] `tasks` and `task_events` tables.
- [x] Task title normalization and candidate matching.
- [x] Confidence rules for auto-apply/review/ignore.
- [x] Task create/update/complete/reopen/blocker transitions.
- [x] Decision/follow-up task events.
- [x] Duplicate task event hash guard.
- [x] `reports` table.
- [x] Batch report aggregation from task events.
- [x] Report formatter with required sections and source references.
- [x] Report job persists report content and sends to Telegram report chat when configured.
- [x] Report grouping by topic and user.
- [x] Telegram MarkdownV2 escaping for reports.
- [x] Long report splitting for Telegram messages.
- [x] Telegram commands: `/setup`, `/topics`, `/watch`, `/unwatch`, `/settings`, `/report`, `/report_today`, `/tasks`, `/done`, `/assign`, `/help`.
- [x] Retry policy and dead-letter queue for jobs.
- [x] Graceful shutdown hooks.
- [x] Non-root Docker image.
- [x] Docker log rotation.
- [x] Database backup and restore scripts.
- [x] Telegram webhook setup script.
- [x] Data retention job.
- [x] Retention windows: raw payload 90 days, normalized processed messages 180 days, AI raw response 30 days.
- [x] Group-scoped data deletion support.
- [x] AI token cost estimation and daily cost guardrail.
- [x] Deployment/runbook documentation.
- [x] HTTPS reverse proxy template.
- [x] Dead-letter alert webhook.
- [x] Completion audit file documenting local evidence and external runtime requirements.
- [x] Runtime environment validator and BotFather/group setup runbook.
- [x] Runtime DB state verifier for remaining completion checkboxes.
- [x] Runtime Telegram webhook replay fixtures.
- [x] Runtime fixtures cover unassigned tasks, username changes, no-username users, reply chains, message edits, duplicates, and no-task conversation.
- [x] Runtime API smoke test script.
- [x] Internal operational metrics endpoint.
- [x] Management dashboard scaffold based on shadcn-admin patterns.
- [x] GitHub OAuth login for the management dashboard with single-admin allowlist.
- [x] VPS deploy script configures task.orokucode.com with Nginx, SSL, dashboard static assets, and required env checks.
- [x] Docker runtime image includes Drizzle config for VPS migrations.
- [x] Telegram Desktop JSON import script for backfilling old messages.
- [x] Docker import wrapper rebuilds the API image before importing Telegram Desktop exports.
- [x] Docker pending-message processor triggers extraction/report for the full pending import range.
- [x] Telegram API runtime check script for bot token/webhook/test chat.
- [x] OpenRouter runtime check script for API key/model JSON response.
- [x] Safe shell `.env` loader for cron values containing spaces.

## Next Up

1. Start Docker daemon and run `npm run prepare:dev`.
2. Verify `npm run test:integration` with PostgreSQL available.
3. Create Telegram bot via BotFather and add it to a test group.
4. Set Telegram/OpenRouter secrets in `.env`.
5. Runtime-test collection, AI extraction, task update, and Telegram reports end-to-end.

## Open Decisions

- Decide whether to commit generated `drizzle/meta/_journal.json` as-is or regenerate with Drizzle Kit after the first migration run.
- Decide whether to address `npm audit` output now or after the MVP skeleton is wider.
- Decide production webhook domain and reverse proxy later.
- Decide whether scheduled extraction/report should run as paired jobs or one orchestration job.

## Environment Notes

- User will set `TELEGRAM_BOT_TOKEN` later.
- Required admin setup value: `ADMIN_TELEGRAM_USER_IDS`.
- Default timezone: `Asia/Ho_Chi_Minh`.
- OpenRouter fields are present; AI calls are skipped until `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are set.

## Reference

- Main plan: `telegram-task-reporter-plan.md`
- Local setup: `README.md`
- Completion evidence: `COMPLETION_AUDIT.md`
