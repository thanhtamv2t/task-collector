# Telegram Group Task Collector & AI Daily Reporter

## 1. Project Overview

Xây dựng một Telegram bot có khả năng:

- Thu thập tin nhắn từ một số topic được chỉ định trong Telegram group.
- Lưu nguyên bản tin nhắn vào PostgreSQL.
- Chạy AI theo batch 2–3 lần mỗi ngày, không cần realtime.
- Trích xuất:
  - Task mới.
  - Tiến độ task.
  - Task hoàn thành.
  - Blocker.
  - Quyết định trong group.
  - Nội dung cần follow-up.
- Tổng hợp report theo:
  - Telegram user.
  - Topic.
  - Khoảng thời gian.
  - Báo cáo trong ngày.
- Gửi report qua Telegram private chat hoặc một topic riêng.

Mục tiêu ưu tiên:

1. MVP nhanh và ổn định.
2. Dữ liệu có audit trail.
3. AI chỉ trích xuất dữ liệu, không trực tiếp kiểm soát database.
4. Không dùng username làm định danh chính.
5. Có thể mở rộng sang Jira, Linear, Notion hoặc dashboard sau này.

---

## 2. Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js 22+ |
| Framework | NestJS |
| Telegram SDK | grammY |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM + Drizzle Kit |
| Job queue | pg-boss |
| Validation | Zod |
| AI provider | OpenRouter |
| Logging | Pino |
| Testing | Vitest hoặc Jest |
| Deployment | Docker Compose |
| Reverse proxy | Nginx hoặc Traefik, thêm sau |
| Monitoring | Health check + structured log |

Không dùng Redis trong MVP.

---

## 3. Core Architecture

```text
Telegram Group
  ├─ Topic A
  ├─ Topic B
  └─ Topic C
        │
        ▼
Telegram Webhook
        │
        ▼
Message Collector
        │
        ├─ Validate group/topic whitelist
        ├─ Normalize Telegram payload
        ├─ Upsert user/group/topic
        └─ Save raw message
        │
        ▼
PostgreSQL
        │
        ▼
pg-boss Scheduler
  ├─ Morning batch
  ├─ Midday batch
  └─ Evening batch
        │
        ▼
AI Task Extractor
        │
        ▼
Task Matcher
        │
        ├─ Create task
        ├─ Update progress
        ├─ Mark completed
        ├─ Add blocker
        └─ Record decision
        │
        ▼
Report Generator
        │
        ▼
Telegram Reporter
```

---

## 4. Main Principles

### 4.1 Telegram identity

Sử dụng:

```text
telegram_user_id = định danh chính
username         = thông tin hiển thị
display_name     = fallback khi không có username
```

Không dùng `username` làm primary key vì username có thể đổi hoặc bị xoá.

### 4.2 Collect trước, AI xử lý sau

Khi nhận message:

```text
Telegram update
  → validate
  → normalize
  → save PostgreSQL
  → return 200
```

Không gọi AI trong webhook.

### 4.3 AI chỉ extract event

AI trả structured JSON.

Application code chịu trách nhiệm:

- Validate output.
- Match với task cũ.
- Kiểm tra confidence.
- Upsert dữ liệu.
- Chống trùng.
- Ghi audit log.

### 4.4 Audit trail

Mọi task và task event phải liên kết được với:

- Group.
- Topic.
- User.
- Source message.
- Thời gian.
- AI confidence.
- Batch xử lý.

---

## 5. Project Scope

## 5.1 MVP In Scope

- Telegram webhook.
- Collect text message và caption.
- Theo dõi một số group/topic được whitelist.
- Lưu raw Telegram payload.
- Upsert Telegram group, topic và user.
- Chạy batch 2–3 lần/ngày.
- AI structured extraction.
- Trích xuất task/progress/done/blocker/decision.
- Match event với task đang mở.
- Tạo report theo user.
- Tạo report theo topic.
- Gửi daily report qua Telegram.
- Command quản trị cơ bản.
- Retry job lỗi.
- Structured logging.
- Docker Compose.
- Database migration.
- Basic unit và integration test.

## 5.2 Out of Scope cho MVP

- Dashboard web.
- Realtime AI.
- Voice message transcription.
- OCR ảnh.
- Vector database.
- Jira/Linear/Notion sync.
- Multi-tenant billing.
- Fine-tuned AI model.
- Advanced role-based access control.
- Semantic search toàn bộ lịch sử.
- Auto-edit message cũ trong Telegram.

---

## 6. Functional Requirements

## 6.1 Message Collector

Bot phải:

- Nhận Telegram webhook update.
- Chỉ xử lý group được whitelist.
- Chỉ xử lý topic được bật theo dõi.
- Hỗ trợ:
  - Text message.
  - Caption của ảnh/file.
  - Reply metadata.
  - Edited message.
- Bỏ qua:
  - Service message không cần thiết.
  - Message từ bot.
  - Topic không theo dõi.
  - Message rỗng.
- Lưu `raw_payload` để debug và audit.
- Chống duplicate bằng:
  - `telegram_chat_id`.
  - `telegram_message_id`.

## 6.2 Topic Management

Mỗi topic cần lưu:

- Group.
- Telegram thread ID.
- Tên topic.
- Trạng thái theo dõi.
- Report destination.
- Thời gian tạo.
- Thời gian cập nhật.

Command cần có:

```text
/setup
/topics
/watch
/unwatch
/settings
```

## 6.3 Batch Processing

Default schedule theo timezone `Asia/Ho_Chi_Minh`:

```text
08:00
14:00
20:00
```

Mỗi batch:

1. Xác định khoảng thời gian cần xử lý.
2. Lấy message chưa xử lý.
3. Group theo group/topic.
4. Tạo conversation chunks.
5. Lấy danh sách task đang mở liên quan.
6. Gửi AI extraction request.
7. Validate JSON.
8. Lưu extraction result.
9. Match event với task.
10. Cập nhật task.
11. Đánh dấu message đã xử lý.
12. Sinh report.
13. Gửi Telegram.
14. Ghi log và metrics.

## 6.4 AI Extraction

AI phải phân loại thành các loại event:

```ts
type ExtractedEventType =
  | "task_created"
  | "task_progress"
  | "task_completed"
  | "task_reopened"
  | "blocker"
  | "decision"
  | "follow_up"
  | "ignore";
```

Mỗi event cần:

```ts
interface ExtractedEvent {
  type: ExtractedEventType;
  title?: string;
  summary: string;
  taskReference?: string;
  assigneeTelegramUserId?: string | null;
  dueDate?: string | null;
  priority?: "low" | "medium" | "high" | "urgent" | null;
  confidence: number;
  sourceMessageIds: number[];
}
```

Rule:

```text
confidence >= 0.80
→ Có thể tự động cập nhật task.

confidence >= 0.50 và < 0.80
→ Lưu vào mục cần xác nhận.

confidence < 0.50
→ Không cập nhật task, chỉ lưu extraction result.
```

## 6.5 Task Matching

Thứ tự match:

1. Task ID hoặc task code xuất hiện trong message.
2. Reply chain liên quan task.
3. Exact/normalized title match.
4. Cùng topic + cùng assignee.
5. Keyword similarity.
6. AI chọn trong tối đa 10 task gần nhất.

Query task candidate:

```sql
select *
from tasks
where group_id = $1
  and topic_id = $2
  and status not in ('done', 'cancelled')
order by last_updated_at desc
limit 10;
```

Không dùng vector database trong MVP.

## 6.6 Report Generation

Report phải hỗ trợ:

- Theo user.
- Theo topic.
- Theo group.
- Theo batch.
- Tổng hợp cả ngày.

Report sections:

```text
✅ Hoàn thành
🔄 Đang thực hiện
🆕 Task mới
⛔ Blocker
📌 Quyết định
⚠️ Cần xác nhận
👤 Chưa xác định người phụ trách
```

Report không được:

- Bịa thêm task.
- Gán sai user khi không đủ dữ liệu.
- Xoá mất source reference.
- Lặp lại cùng task nhiều lần.

---

## 7. Suggested Project Structure

```text
src/
├── main.ts
├── worker.ts
├── app.module.ts
│
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── telegram.config.ts
│   ├── ai.config.ts
│   └── validation.ts
│
├── database/
│   ├── database.module.ts
│   ├── database.service.ts
│   ├── schema/
│   │   ├── groups.schema.ts
│   │   ├── topics.schema.ts
│   │   ├── users.schema.ts
│   │   ├── messages.schema.ts
│   │   ├── tasks.schema.ts
│   │   ├── task-events.schema.ts
│   │   ├── ai-runs.schema.ts
│   │   ├── reports.schema.ts
│   │   └── index.ts
│   └── migrations/
│
├── modules/
│   ├── telegram/
│   │   ├── telegram.module.ts
│   │   ├── telegram.controller.ts
│   │   ├── telegram-bot.service.ts
│   │   ├── telegram-update.parser.ts
│   │   ├── telegram-reporter.service.ts
│   │   └── commands/
│   │
│   ├── collector/
│   │   ├── collector.module.ts
│   │   ├── collector.service.ts
│   │   └── collector.repository.ts
│   │
│   ├── groups/
│   │   ├── groups.module.ts
│   │   ├── groups.service.ts
│   │   └── groups.repository.ts
│   │
│   ├── topics/
│   │   ├── topics.module.ts
│   │   ├── topics.service.ts
│   │   └── topics.repository.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── users.repository.ts
│   │
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── openrouter.client.ts
│   │   ├── task-extractor.service.ts
│   │   ├── report-generator.service.ts
│   │   ├── prompts/
│   │   └── schemas/
│   │
│   ├── tasks/
│   │   ├── tasks.module.ts
│   │   ├── tasks.service.ts
│   │   ├── task-matcher.service.ts
│   │   ├── task-events.service.ts
│   │   └── tasks.repository.ts
│   │
│   ├── reports/
│   │   ├── reports.module.ts
│   │   ├── reports.service.ts
│   │   ├── report-formatter.service.ts
│   │   └── reports.repository.ts
│   │
│   └── jobs/
│       ├── jobs.module.ts
│       ├── job-scheduler.service.ts
│       ├── extraction.job.ts
│       ├── report.job.ts
│       └── retry-failed.job.ts
│
└── common/
    ├── constants/
    ├── errors/
    ├── logger/
    ├── types/
    └── utils/
```

---

## 8. Database Schema

## 8.1 telegram_groups

```sql
create table telegram_groups (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null unique,
  title varchar(255),
  is_active boolean not null default true,
  report_chat_id bigint,
  timezone varchar(100) not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 8.2 telegram_topics

```sql
create table telegram_topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references telegram_groups(id) on delete cascade,
  telegram_thread_id bigint,
  name varchar(255),
  is_monitored boolean not null default false,
  report_thread_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(group_id, telegram_thread_id)
);
```

## 8.3 telegram_users

```sql
create table telegram_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username varchar(255),
  first_name varchar(255),
  last_name varchar(255),
  display_name varchar(255),
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 8.4 messages

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references telegram_groups(id) on delete cascade,
  topic_id uuid references telegram_topics(id) on delete set null,
  user_id uuid references telegram_users(id) on delete set null,

  telegram_message_id bigint not null,
  reply_to_message_id bigint,

  message_type varchar(50) not null,
  text text,
  raw_payload jsonb not null,

  sent_at timestamptz not null,
  edited_at timestamptz,

  processing_status varchar(30) not null default 'pending',
  batch_id uuid,
  processed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(group_id, telegram_message_id)
);

create index idx_messages_processing
on messages(processing_status, sent_at);

create index idx_messages_topic_time
on messages(topic_id, sent_at);

create index idx_messages_user_time
on messages(user_id, sent_at);
```

## 8.5 tasks

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references telegram_groups(id) on delete cascade,
  topic_id uuid references telegram_topics(id) on delete set null,

  title text not null,
  normalized_title text not null,
  description text,

  assignee_user_id uuid references telegram_users(id) on delete set null,

  status varchar(30) not null default 'open',
  priority varchar(20),
  due_date timestamptz,

  ai_confidence numeric(4,3),
  first_seen_at timestamptz not null,
  last_updated_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_open_by_topic
on tasks(group_id, topic_id, status, last_updated_at desc);

create index idx_tasks_assignee
on tasks(assignee_user_id, status, last_updated_at desc);
```

## 8.6 task_events

```sql
create table task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  group_id uuid not null references telegram_groups(id) on delete cascade,
  topic_id uuid references telegram_topics(id) on delete set null,

  event_type varchar(50) not null,
  summary text not null,

  actor_user_id uuid references telegram_users(id) on delete set null,
  source_message_ids jsonb not null default '[]',

  ai_confidence numeric(4,3),
  occurred_at timestamptz not null,

  created_at timestamptz not null default now()
);
```

## 8.7 ai_runs

```sql
create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references telegram_groups(id) on delete cascade,
  topic_id uuid references telegram_topics(id) on delete set null,

  run_type varchar(30) not null,
  model varchar(100) not null,

  input_message_ids jsonb not null,
  prompt_version varchar(50) not null,

  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(12,6),

  status varchar(30) not null,
  raw_response jsonb,
  error_message text,

  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 8.8 reports

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references telegram_groups(id) on delete cascade,

  report_type varchar(30) not null,
  period_start timestamptz not null,
  period_end timestamptz not null,

  content text not null,
  structured_content jsonb not null,

  telegram_chat_id bigint,
  telegram_thread_id bigint,
  telegram_message_id bigint,

  status varchar(30) not null default 'pending',
  sent_at timestamptz,

  created_at timestamptz not null default now(),

  unique(group_id, report_type, period_start, period_end)
);
```

---

## 9. API and Webhook Design

## 9.1 Telegram webhook endpoint

```http
POST /webhooks/telegram
```

Responsibilities:

- Validate secret token header.
- Parse update.
- Persist supported message.
- Return nhanh.
- Không gọi AI.

## 9.2 Health endpoints

```http
GET /health
GET /health/live
GET /health/ready
```

Readiness cần kiểm tra:

- PostgreSQL connection.
- pg-boss connection.
- Telegram bot configuration.
- OpenRouter API key presence.

## 9.3 Internal/manual endpoints

Chỉ dùng admin token:

```http
POST /internal/jobs/extract
POST /internal/jobs/report
POST /internal/groups/:id/reprocess
GET  /internal/jobs/:id
```

---

## 10. Telegram Commands

```text
/setup
Đăng ký group hiện tại.

/topics
Hiển thị các topic bot đã nhận diện.

/watch
Bật theo dõi topic hiện tại.

/unwatch
Tắt theo dõi topic hiện tại.

/settings
Hiển thị cấu hình group.

/report
Tạo report cho batch gần nhất.

/report_today
Tạo report từ đầu ngày đến hiện tại.

/tasks
Hiển thị task đang mở.

/done <task-id>
Xác nhận task đã hoàn thành.

/assign <task-id> @username
Gán người phụ trách.

/help
Hiển thị hướng dẫn.
```

Command quản trị chỉ được sử dụng bởi Telegram user ID nằm trong `ADMIN_TELEGRAM_USER_IDS`.

---

## 11. AI Prompt Requirements

System prompt phải nêu rõ:

```text
- Chỉ trích xuất nội dung có bằng chứng trong message.
- Không suy đoán người phụ trách.
- Không xem câu hỏi hoặc thảo luận chung là task.
- Phân biệt task mới, progress, done, blocker và decision.
- Mọi event phải chứa source_message_ids.
- Confidence từ 0 đến 1.
- Không thêm deadline nếu message không có.
- Không tự tạo task ID.
- Trả JSON đúng schema.
```

Input gồm:

```text
Group
Topic
Period
Known users
Open tasks
Messages theo thứ tự thời gian
```

Output phải được validate bằng Zod.

Retry policy:

```text
Lần 1: structured output bình thường.
Lần 2: gửi validation errors và yêu cầu sửa JSON.
Lần 3: đánh dấu ai_run failed.
```

---

## 12. OpenRouter Configuration

Environment variables:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=
OPENROUTER_FALLBACK_MODEL=
OPENROUTER_APP_NAME=telegram-task-reporter
OPENROUTER_SITE_URL=
```

AI client cần:

- Timeout.
- Retry exponential backoff.
- Token usage logging.
- Cost estimation.
- Model fallback.
- Response schema validation.

Không hard-code model trong business logic.

---

## 13. Environment Variables

```env
NODE_ENV=development
PORT=3000
APP_TIMEZONE=Asia/Ho_Chi_Minh

DATABASE_URL=postgresql://telegram_reporter:password@postgres:5432/telegram_reporter

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=
ADMIN_TELEGRAM_USER_IDS=

OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=
OPENROUTER_FALLBACK_MODEL=

REPORT_SCHEDULES=0 8 * * *,0 14 * * *,0 20 * * *
AI_AUTO_APPLY_CONFIDENCE=0.8
AI_REVIEW_CONFIDENCE=0.5

LOG_LEVEL=info
```

---

## 14. Docker Compose

```yaml
services:
  api:
    build:
      context: .
    command: ["node", "dist/main.js"]
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build:
      context: .
    command: ["node", "dist/worker.js"]
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: telegram_reporter
      POSTGRES_USER: telegram_reporter
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U telegram_reporter -d telegram_reporter"
        ]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

---

## 15. Processing State Machine

Message state:

```text
pending
  → processing
  → processed

processing
  → failed
  → pending, khi retry
```

AI run state:

```text
queued
  → running
  → completed

running
  → failed
```

Report state:

```text
pending
  → sending
  → sent

sending
  → failed
```

Task state:

```text
open
  → in_progress
  → blocked
  → done

done
  → reopened

open/in_progress/blocked
  → cancelled
```

---

## 16. Idempotency Rules

### Message

```text
unique(group_id, telegram_message_id)
```

### Batch

Tạo deterministic batch key:

```text
group_id + topic_id + period_start + period_end + job_type
```

### Report

```text
unique(group_id, report_type, period_start, period_end)
```

### Task event

Hash:

```text
task_id + event_type + sorted(source_message_ids)
```

Không tạo task event mới khi hash đã tồn tại.

---

## 17. Error Handling

Các nhóm lỗi:

```text
Telegram validation error
Database error
AI timeout
AI invalid JSON
AI rate limit
Report send failure
Unknown topic
Permission denied
Duplicate event
```

Mỗi lỗi cần:

- Structured log.
- Correlation ID.
- Batch ID.
- Group ID.
- Topic ID.
- Retryable flag.
- Error stack trong server log.
- Không gửi secret vào Telegram.

Retry đề xuất:

```text
Database transient error: 3 lần
OpenRouter timeout: 3 lần
Telegram send error: 3 lần
Invalid AI JSON: tối đa 2 lần sửa
```

---

## 18. Security

- Telegram webhook dùng secret token.
- Admin command kiểm tra Telegram user ID.
- Không log Telegram bot token.
- Không log OpenRouter API key.
- Raw message được xem là dữ liệu nội bộ.
- Có retention policy.
- Chỉ collect group/topic đã whitelist.
- Hỗ trợ xoá dữ liệu theo group.
- Database không expose public port trong production.
- Internal API dùng admin token hoặc private network.
- Docker container chạy non-root.
- Validate mọi environment variable khi startup.

---

## 19. Data Retention

Default:

```text
Raw Telegram payload: 90 ngày
Normalized message: 180 ngày
Task/task event: không tự xoá
AI raw response: 30 ngày
Report: không tự xoá
Application log: 14–30 ngày
```

Retention phải cấu hình qua environment variable trong phase sau.

---

## 20. Testing Strategy

## 20.1 Unit tests

- Telegram update parser.
- Message normalization.
- Topic whitelist.
- AI output schema.
- Confidence threshold.
- Task matcher.
- Report formatter.
- Idempotency key.
- Message chunking.

## 20.2 Integration tests

- Webhook → PostgreSQL.
- Batch job → mock OpenRouter.
- AI event → task update.
- Report generation → mock Telegram API.
- Retry failed job.
- Duplicate Telegram update.

## 20.3 Test fixtures

Tạo fixtures cho:

```text
Task mới rõ ràng
Task hoàn thành
Progress update
Blocker
Decision
Task không có assignee
Username thay đổi
User không có username
Reply chain
Message edit
Duplicate update
Conversation không có task
```

---

## 21. Observability

Structured log fields:

```text
request_id
job_id
batch_id
group_id
topic_id
telegram_message_id
ai_run_id
report_id
duration_ms
status
error_code
```

Metrics tối thiểu:

```text
Messages collected
Messages ignored
Messages processed
AI runs
AI failures
AI token usage
AI estimated cost
Tasks created
Task events created
Reports sent
Reports failed
Job duration
```

---

## 22. Implementation Milestones

## Milestone 0 — Bootstrap

Checklist:

- [x] Khởi tạo NestJS project.
- [x] Bật TypeScript strict mode.
- [x] Cấu hình ESLint và Prettier.
- [x] Cấu hình environment validation.
- [x] Tạo Dockerfile.
- [x] Tạo Docker Compose.
- [x] Cấu hình PostgreSQL.
- [x] Cấu hình Drizzle.
- [x] Tạo health check.
- [x] Cấu hình Pino logger.
- [x] Tạo `main.ts` và `worker.ts`.

Definition of Done:

```text
docker compose up
→ API chạy
→ Worker chạy
→ PostgreSQL healthy
→ /health trả 200
```

## Milestone 1 — Telegram Collector

Checklist:

- [ ] Tạo bot bằng BotFather.
- [ ] Add bot vào group test.
- [ ] Cấu hình privacy/admin phù hợp.
- [x] Tạo webhook endpoint.
- [x] Validate webhook secret.
- [x] Parse Telegram update.
- [x] Upsert group.
- [x] Upsert topic.
- [x] Upsert user.
- [x] Lưu message.
- [x] Chống duplicate.
- [x] Bỏ qua bot message.
- [x] Test edited message.
- [x] Implement `/setup`.
- [x] Implement `/topics`.
- [x] Implement `/watch`.
- [x] Implement `/unwatch`.

Definition of Done:

```text
Message gửi trong topic được watch
→ được lưu đúng group/topic/user
→ raw_payload tồn tại
→ message duplicate không bị lưu lần hai
```

## Milestone 2 — Job Queue & Scheduler

Checklist:

- [x] Tích hợp pg-boss.
- [x] Tạo scheduler service.
- [x] Tạo extraction job.
- [x] Tạo report job.
- [x] Tạo retry failed job.
- [x] Cấu hình cron theo timezone.
- [x] Tạo batch record hoặc batch key.
- [x] Lock message trong quá trình xử lý.
- [x] Implement idempotency.

Definition of Done:

```text
Job manual trigger
→ lấy message pending
→ lock đúng batch
→ không xử lý trùng
```

## Milestone 3 — AI Extraction

Checklist:

- [x] Tạo OpenRouter client.
- [x] Cấu hình model qua environment.
- [x] Tạo Zod output schema.
- [x] Tạo extraction prompt version 1.
- [x] Chunk message theo token limit.
- [x] Gửi open tasks vào context.
- [x] Validate AI JSON.
- [x] Retry invalid output.
- [x] Lưu ai_runs.
- [x] Log token usage và cost.
- [x] Test với fixtures.

Definition of Done:

```text
Một batch message
→ AI trả structured events
→ output qua Zod
→ source_message_ids hợp lệ
→ ai_run được lưu
```

## Milestone 4 — Task Engine

Checklist:

- [x] Tạo task repository.
- [x] Tạo task event repository.
- [x] Implement normalized title.
- [x] Implement task candidate query.
- [x] Implement task matching.
- [x] Apply confidence rules.
- [x] Create task.
- [x] Update progress.
- [x] Complete task.
- [x] Reopen task.
- [x] Add blocker.
- [x] Store decision.
- [x] Chống duplicate task event.

Definition of Done:

```text
AI event
→ match đúng task hoặc tạo task mới
→ task event có source messages
→ confidence thấp không tự apply
```

## Milestone 5 — Report Generator

Checklist:

- [x] Tạo report aggregation query.
- [x] Group theo user.
- [x] Group theo topic.
- [x] Tạo report template.
- [x] Escape Telegram Markdown.
- [x] Chia report dài thành nhiều message.
- [x] Gửi report private chat.
- [x] Lưu telegram_message_id.
- [x] Implement `/report`.
- [x] Implement `/report_today`.
- [x] Implement `/tasks`.

Definition of Done:

```text
Report chứa:
- task mới
- tiến độ
- hoàn thành
- blocker
- decision
- cần xác nhận

Report gửi thành công qua Telegram.
```

## Milestone 6 — Reliability & Production

Checklist:

- [x] Retry policy.
- [x] Dead-letter handling.
- [x] Graceful shutdown.
- [x] Database backup.
- [x] Non-root Docker image.
- [x] Production webhook setup.
- [x] HTTPS reverse proxy.
- [x] Log rotation.
- [x] Data retention job.
- [x] Cost guardrail.
- [x] Alert khi job thất bại liên tiếp.
- [x] README deploy.
- [x] Runbook xử lý sự cố.

Definition of Done:

```text
Bot chạy liên tục bằng Docker Compose.
Restart không mất job.
Message và report không bị duplicate.
Có backup và cách restore.
```

---

## 23. Suggested First Sprint

Mục tiêu sprint đầu tiên:

```text
Telegram message
→ webhook
→ PostgreSQL
→ xem được group/topic/user/message
```

Tasks:

1. Bootstrap NestJS.
2. Setup Docker Compose.
3. Setup Drizzle.
4. Tạo 4 table đầu:
   - telegram_groups.
   - telegram_topics.
   - telegram_users.
   - messages.
5. Setup grammY.
6. Tạo webhook.
7. Lưu message.
8. Implement `/setup`, `/topics`, `/watch`.
9. Viết integration test.
10. Viết README local development.

Không triển khai AI trong sprint đầu tiên.

---

## 24. Coding Conventions

- TypeScript strict.
- Không dùng `any` trừ boundary raw payload.
- Repository không chứa business logic.
- Service không gọi SQL trực tiếp nếu đã có repository.
- Zod validate:
  - Environment.
  - Telegram normalized payload.
  - AI output.
- Mọi timestamp lưu UTC.
- Chỉ convert timezone khi tạo report.
- Dùng UUID nội bộ.
- Telegram ID lưu `bigint`.
- Log JSON ở production.
- Mỗi migration phải có rollback plan.
- Prompt AI phải có version.

---

## 25. Definition of Done cho MVP

MVP hoàn thành khi:

- [ ] Bot collect được message từ các topic được chọn.
- [ ] Message lưu đúng user, group và topic.
- [ ] Message không bị duplicate.
- [ ] Batch chạy 2–3 lần/ngày.
- [ ] AI trích xuất được task event dạng JSON.
- [ ] Task có source message và confidence.
- [ ] Report tổng hợp theo user.
- [ ] Report tổng hợp theo ngày.
- [ ] Report gửi về Telegram private chat.
- [x] Có retry khi AI hoặc Telegram lỗi.
- [x] Có Docker Compose.
- [x] Có migration.
- [x] Có test cho luồng chính.
- [x] Có README setup/deploy.
- [x] Có audit trail.
- [x] Có log token và chi phí AI.

---

## 26. Bootstrap Prompt cho Codex/Claude

```text
Bạn đang triển khai một Telegram Group Task Collector & AI Daily Reporter.

Đọc toàn bộ file plan.md trước khi code.

Tech stack bắt buộc:
- Node.js 22+
- NestJS
- TypeScript strict
- PostgreSQL 17
- Drizzle ORM + Drizzle Kit
- grammY
- pg-boss
- Zod
- Pino
- OpenRouter
- Docker Compose

Nguyên tắc:
- Telegram webhook chỉ collect và lưu message, không gọi AI.
- Telegram user ID là định danh chính, không dùng username làm primary key.
- AI chỉ trả structured events.
- Application code kiểm soát task matching và database update.
- Mọi task event phải có source message IDs.
- Phải có idempotency.
- Mọi timestamp lưu UTC.
- Default timezone report là Asia/Ho_Chi_Minh.

Bắt đầu với Milestone 0 và Milestone 1.

Yêu cầu đầu ra:
1. Bootstrap project hoàn chỉnh.
2. Dockerfile và docker-compose.yml.
3. Environment validation.
4. Drizzle schema và migration cho:
   - telegram_groups
   - telegram_topics
   - telegram_users
   - messages
5. Telegram webhook endpoint.
6. Telegram update parser.
7. Collector service.
8. Commands:
   - /setup
   - /topics
   - /watch
   - /unwatch
9. Health endpoints.
10. Unit test và integration test cơ bản.
11. README hướng dẫn local setup.

Không triển khai AI hoặc report ở bước đầu.
Sau khi hoàn thành, cập nhật checklist trong plan.md và ghi rõ các phần còn lại.
```

---

## 27. Future Enhancements

Sau MVP:

```text
Dashboard Next.js
Jira/Linear/Notion integration
Task approval workflow
Weekly report
Risk scoring
Decision log
Change log
Project mapping
Vector search
Voice transcription
Image OCR
Multi-group dashboard
Role-based permissions
Follow-up reminder
Telegram inline buttons
Manual task correction
Cost dashboard
```
