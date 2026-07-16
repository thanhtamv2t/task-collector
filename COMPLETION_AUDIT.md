# Completion Audit

This file tracks evidence against `telegram-task-reporter-plan.md`.

## Verified By Local Commands

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run runtime:validate`
- `sh -n scripts/*.sh`

## Evidence Implemented In Repo

- Docker Compose: `docker-compose.yml`
- Migration/schema: `drizzle/0000_bootstrap_collector.sql`, `drizzle/0000_bootstrap_collector.down.sql`, `src/database/schema/*`
- Telegram collector: `src/modules/telegram/*`, `src/modules/collector/*`
- Telegram admin commands: `/setup`, `/topics`, `/watch`, `/unwatch`, `/settings`, `/report`, `/report_today`, `/tasks`, `/done`, `/assign`, `/help`
- Jobs/scheduler/retry/dead-letter: `src/modules/jobs/*`
- Internal manual endpoints, group reprocess, group data deletion, and metrics: `src/modules/internal/*`
- Management dashboard scaffold: `dashboard/*`
- GitHub OAuth dashboard login with admin allowlist: `src/modules/auth/*`
- AI extraction: `src/modules/ai/*`
- Task engine and audit trail: `src/modules/tasks/*`
- Reports and Telegram commands: `src/modules/reports/*`, `src/modules/collector/collector.service.ts`
- Setup/deploy/runbook: `README.md`, `RUNBOOK.md`, `scripts/*`, `deploy/*`
- VPS domain deploy automation: `scripts/vps-auto-setup.sh` configures `task.orokucode.com`, Nginx, Certbot, and required env checks.
- Retention windows: raw payload scrub after 90 days, processed normalized messages after 180 days, AI raw responses after 30 days
- Runtime env validation: `scripts/validate-runtime-env.sh`, `npm run runtime:validate`
- Runtime DB state verification: `scripts/verify-runtime-state.sh`, `npm run runtime:verify-state`
- Runtime API smoke verification: `scripts/smoke-api.sh`, `npm run runtime:smoke-api`
- Telegram API runtime verification: `scripts/check-telegram-runtime.sh`, `npm run runtime:telegram-check`
- OpenRouter runtime verification: `scripts/check-openrouter-runtime.sh`, `npm run runtime:openrouter-check`
- Runtime Telegram fixture replay: `scripts/replay-telegram-fixtures.sh`, `test/fixtures/telegram-runtime/*`
- Runtime fixture coverage test: `test/telegram-runtime-fixtures.spec.ts`
- Safe `.env` loading for shell scripts with values containing spaces: `scripts/lib-env.sh`

## Runtime Items Still Requiring External State

- Create a real Telegram bot with BotFather.
- Add the bot to a real Telegram group and configure privacy/admin permissions.
- Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `ADMIN_TELEGRAM_USER_IDS`, and OpenRouter credentials.
- Optionally set `AI_DAILY_COST_LIMIT_USD`, OpenRouter token prices, and `ALERT_WEBHOOK_URL`.
- Run Docker daemon/PostgreSQL and execute `npm run prepare:dev`.
- Run `npm run test:integration` with PostgreSQL available.
- Send real Telegram messages in watched topics and verify end-to-end collection/report delivery.
- Configure a production domain/TLS certificate for the Nginx reverse proxy template.

## Current Non-External Gaps

- None known from the checklist after local build/unit/lint verification.

## Remaining Plan Checkboxes

The remaining unchecked boxes in `telegram-task-reporter-plan.md` are intentionally not marked
complete because they require real external runtime evidence:

- BotFather bot creation and Telegram group setup.
- Docker/PostgreSQL integration run.
- Real Telegram message collection from watched topics.
- Real OpenRouter extraction.
- Real Telegram report delivery.
