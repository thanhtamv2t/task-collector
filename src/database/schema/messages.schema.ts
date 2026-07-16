import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { telegramGroups } from './groups.schema';
import { telegramTopics } from './topics.schema';
import { telegramUsers } from './users.schema';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => telegramGroups.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').references(() => telegramTopics.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => telegramUsers.id, { onDelete: 'set null' }),
    telegramMessageId: text('telegram_message_id').notNull(),
    replyToMessageId: text('reply_to_message_id'),
    messageType: varchar('message_type', { length: 50 }).notNull(),
    text: text('text'),
    rawPayload: jsonb('raw_payload').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    processingStatus: varchar('processing_status', { length: 30 }).notNull().default('pending'),
    batchId: uuid('batch_id'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    groupMessageUnique: unique('messages_group_message_unique').on(
      table.groupId,
      table.telegramMessageId,
    ),
    processingIdx: index('idx_messages_processing').on(table.processingStatus, table.sentAt),
    topicTimeIdx: index('idx_messages_topic_time').on(table.topicId, table.sentAt),
    userTimeIdx: index('idx_messages_user_time').on(table.userId, table.sentAt),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
