CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS telegram_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id text NOT NULL UNIQUE,
  title varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  report_chat_id text,
  timezone varchar(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_groups_chat_id
ON telegram_groups(telegram_chat_id);

CREATE TABLE IF NOT EXISTS telegram_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES telegram_groups(id) ON DELETE CASCADE,
  telegram_thread_id text,
  name varchar(255),
  is_monitored boolean NOT NULL DEFAULT false,
  report_thread_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_topics_group_thread_unique UNIQUE(group_id, telegram_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_topics_group
ON telegram_topics(group_id);

CREATE TABLE IF NOT EXISTS telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id text NOT NULL UNIQUE,
  username varchar(255),
  first_name varchar(255),
  last_name varchar(255),
  display_name varchar(255),
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id
ON telegram_users(telegram_user_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES telegram_groups(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES telegram_topics(id) ON DELETE SET NULL,
  user_id uuid REFERENCES telegram_users(id) ON DELETE SET NULL,
  telegram_message_id text NOT NULL,
  reply_to_message_id text,
  message_type varchar(50) NOT NULL,
  text text,
  raw_payload jsonb NOT NULL,
  sent_at timestamptz NOT NULL,
  edited_at timestamptz,
  processing_status varchar(30) NOT NULL DEFAULT 'pending',
  batch_id uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_group_message_unique UNIQUE(group_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_processing
ON messages(processing_status, sent_at);

CREATE INDEX IF NOT EXISTS idx_messages_topic_time
ON messages(topic_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_messages_user_time
ON messages(user_id, sent_at);

CREATE TABLE IF NOT EXISTS job_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key text NOT NULL,
  job_type varchar(50) NOT NULL,
  group_id uuid,
  topic_id uuid,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'queued',
  locked_message_ids jsonb NOT NULL DEFAULT '[]',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT job_batches_batch_key_unique UNIQUE(batch_key)
);

CREATE INDEX IF NOT EXISTS idx_job_batches_status
ON job_batches(status, created_at);

CREATE INDEX IF NOT EXISTS idx_job_batches_period
ON job_batches(job_type, period_start, period_end);

CREATE TABLE IF NOT EXISTS ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES telegram_groups(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES telegram_topics(id) ON DELETE SET NULL,
  run_type varchar(30) NOT NULL,
  model varchar(100) NOT NULL,
  input_message_ids jsonb NOT NULL,
  prompt_version varchar(50) NOT NULL,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(12,6),
  status varchar(30) NOT NULL,
  raw_response jsonb,
  error_message text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES telegram_groups(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES telegram_topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  normalized_title text NOT NULL,
  description text,
  assignee_user_id uuid REFERENCES telegram_users(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'open',
  priority varchar(20),
  due_date timestamptz,
  ai_confidence numeric(4,3),
  first_seen_at timestamptz NOT NULL,
  last_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_open_by_topic
ON tasks(group_id, topic_id, status, last_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee
ON tasks(assignee_user_id, status, last_updated_at DESC);

CREATE TABLE IF NOT EXISTS task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES telegram_groups(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES telegram_topics(id) ON DELETE SET NULL,
  event_type varchar(50) NOT NULL,
  summary text NOT NULL,
  actor_user_id uuid REFERENCES telegram_users(id) ON DELETE SET NULL,
  source_message_ids jsonb NOT NULL DEFAULT '[]',
  event_hash text NOT NULL UNIQUE,
  ai_confidence numeric(4,3),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task
ON task_events(task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_task_events_group_topic
ON task_events(group_id, topic_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES telegram_groups(id) ON DELETE CASCADE,
  report_type varchar(30) NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  content text NOT NULL,
  structured_content jsonb NOT NULL,
  telegram_chat_id text,
  telegram_thread_id text,
  telegram_message_id text,
  status varchar(30) NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_group_type_period_unique UNIQUE(group_id, report_type, period_start, period_end)
);
