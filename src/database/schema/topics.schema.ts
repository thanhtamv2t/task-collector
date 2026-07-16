import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { telegramGroups } from './groups.schema';

export const telegramTopics = pgTable(
  'telegram_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => telegramGroups.id, { onDelete: 'cascade' }),
    telegramThreadId: text('telegram_thread_id'),
    name: varchar('name', { length: 255 }),
    isMonitored: boolean('is_monitored').notNull().default(false),
    reportThreadId: text('report_thread_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    groupThreadUnique: unique('telegram_topics_group_thread_unique').on(
      table.groupId,
      table.telegramThreadId,
    ),
    groupIdx: index('idx_telegram_topics_group').on(table.groupId),
  }),
);

export type TelegramTopic = typeof telegramTopics.$inferSelect;
export type NewTelegramTopic = typeof telegramTopics.$inferInsert;
