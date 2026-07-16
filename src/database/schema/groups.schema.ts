import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const telegramGroups = pgTable(
  'telegram_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    telegramChatId: text('telegram_chat_id').notNull().unique(),
    title: varchar('title', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    reportChatId: text('report_chat_id'),
    timezone: varchar('timezone', { length: 100 }).notNull().default('Asia/Ho_Chi_Minh'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    telegramChatIdIdx: index('idx_telegram_groups_chat_id').on(table.telegramChatId),
  }),
);

export type TelegramGroup = typeof telegramGroups.$inferSelect;
export type NewTelegramGroup = typeof telegramGroups.$inferInsert;
