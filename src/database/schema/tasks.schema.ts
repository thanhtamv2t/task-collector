import { index, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { telegramGroups } from './groups.schema';
import { telegramTopics } from './topics.schema';
import { telegramUsers } from './users.schema';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => telegramGroups.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').references(() => telegramTopics.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    normalizedTitle: text('normalized_title').notNull(),
    description: text('description'),
    assigneeUserId: uuid('assignee_user_id').references(() => telegramUsers.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 30 }).notNull().default('open'),
    priority: varchar('priority', { length: 20 }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    aiConfidence: numeric('ai_confidence', { precision: 4, scale: 3 }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    openByTopicIdx: index('idx_tasks_open_by_topic').on(
      table.groupId,
      table.topicId,
      table.status,
      table.lastUpdatedAt,
    ),
    assigneeIdx: index('idx_tasks_assignee').on(table.assigneeUserId, table.status, table.lastUpdatedAt),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
