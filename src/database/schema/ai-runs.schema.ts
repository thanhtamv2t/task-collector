import { integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { telegramGroups } from './groups.schema';
import { telegramTopics } from './topics.schema';

export const aiRuns = pgTable('ai_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => telegramGroups.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => telegramTopics.id, { onDelete: 'set null' }),
  runType: varchar('run_type', { length: 30 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  inputMessageIds: jsonb('input_message_ids').notNull(),
  promptVersion: varchar('prompt_version', { length: 50 }).notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 6 }),
  status: varchar('status', { length: 30 }).notNull(),
  rawResponse: jsonb('raw_response'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AiRun = typeof aiRuns.$inferSelect;
export type NewAiRun = typeof aiRuns.$inferInsert;
