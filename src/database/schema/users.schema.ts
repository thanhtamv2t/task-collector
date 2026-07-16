import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const telegramUsers = pgTable(
  'telegram_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    telegramUserId: text('telegram_user_id').notNull().unique(),
    username: varchar('username', { length: 255 }),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }),
    isBot: boolean('is_bot').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    telegramUserIdIdx: index('idx_telegram_users_user_id').on(table.telegramUserId),
  }),
);

export type TelegramUser = typeof telegramUsers.$inferSelect;
export type NewTelegramUser = typeof telegramUsers.$inferInsert;
