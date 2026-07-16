import { index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tasks } from './tasks.schema';
import { telegramGroups } from './groups.schema';
import { telegramTopics } from './topics.schema';
import { telegramUsers } from './users.schema';

export const taskEvents = pgTable(
  'task_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => telegramGroups.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').references(() => telegramTopics.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    summary: text('summary').notNull(),
    actorUserId: uuid('actor_user_id').references(() => telegramUsers.id, { onDelete: 'set null' }),
    sourceMessageIds: jsonb('source_message_ids').notNull().default([]),
    eventHash: text('event_hash').notNull().unique(),
    aiConfidence: numeric('ai_confidence', { precision: 4, scale: 3 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskIdx: index('idx_task_events_task').on(table.taskId, table.createdAt),
    groupTopicIdx: index('idx_task_events_group_topic').on(table.groupId, table.topicId, table.createdAt),
  }),
);

export type TaskEvent = typeof taskEvents.$inferSelect;
export type NewTaskEvent = typeof taskEvents.$inferInsert;
