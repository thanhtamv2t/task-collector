import { jsonb, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { telegramGroups } from './groups.schema';

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => telegramGroups.id, { onDelete: 'cascade' }),
    reportType: varchar('report_type', { length: 30 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    content: text('content').notNull(),
    structuredContent: jsonb('structured_content').notNull(),
    telegramChatId: text('telegram_chat_id'),
    telegramThreadId: text('telegram_thread_id'),
    telegramMessageId: text('telegram_message_id'),
    status: varchar('status', { length: 30 }).notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reportPeriodUnique: unique('reports_group_type_period_unique').on(
      table.groupId,
      table.reportType,
      table.periodStart,
      table.periodEnd,
    ),
  }),
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
