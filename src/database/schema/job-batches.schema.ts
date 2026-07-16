import { index, jsonb, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const jobBatches = pgTable(
  'job_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchKey: text('batch_key').notNull(),
    jobType: varchar('job_type', { length: 50 }).notNull(),
    groupId: uuid('group_id'),
    topicId: uuid('topic_id'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('queued'),
    lockedMessageIds: jsonb('locked_message_ids').notNull().default([]),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    batchKeyUnique: unique('job_batches_batch_key_unique').on(table.batchKey),
    statusIdx: index('idx_job_batches_status').on(table.status, table.createdAt),
    periodIdx: index('idx_job_batches_period').on(table.jobType, table.periodStart, table.periodEnd),
  }),
);

export type JobBatch = typeof jobBatches.$inferSelect;
export type NewJobBatch = typeof jobBatches.$inferInsert;
