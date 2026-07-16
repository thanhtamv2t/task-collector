import { Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lt, sql, SQL } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  aiRuns,
  jobBatches,
  messages,
  telegramGroups,
  telegramTopics,
  telegramUsers,
} from '../../database/schema';

export interface EnsureBatchInput {
  jobType: string;
  batchKey: string;
  groupId: string | null;
  topicId: string | null;
  periodStart: Date;
  periodEnd: Date;
}

export interface DailyReportReminderGroup {
  telegramChatId: string;
  title: string | null;
  users: Array<{
    telegramUserId: string;
    username: string | null;
    displayName: string | null;
  }>;
}

@Injectable()
export class JobsRepository {
  constructor(private readonly database: DatabaseService) {}

  async ensureBatch(input: EnsureBatchInput): Promise<{
    id: string;
    batchKey: string;
    status: string;
    created: boolean;
  }> {
    const inserted = await this.database.db
      .insert(jobBatches)
      .values({
        batchKey: input.batchKey,
        jobType: input.jobType,
        groupId: input.groupId,
        topicId: input.topicId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'queued',
      })
      .onConflictDoNothing({
        target: jobBatches.batchKey,
      })
      .returning({
        id: jobBatches.id,
        batchKey: jobBatches.batchKey,
        status: jobBatches.status,
      });

    if (inserted[0]) {
      return { ...inserted[0], created: true };
    }

    const [existing] = await this.database.db
      .select({
        id: jobBatches.id,
        batchKey: jobBatches.batchKey,
        status: jobBatches.status,
      })
      .from(jobBatches)
      .where(eq(jobBatches.batchKey, input.batchKey))
      .limit(1);

    if (!existing) {
      throw new Error(`Unable to create or find batch ${input.batchKey}`);
    }

    return { ...existing, created: false };
  }

  async markBatchRunning(batchId: string): Promise<void> {
    await this.database.db
      .update(jobBatches)
      .set({
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(jobBatches.id, batchId));
  }

  async markBatchCompleted(batchId: string, lockedMessageIds: string[]): Promise<void> {
    await this.database.db
      .update(jobBatches)
      .set({
        status: 'completed',
        lockedMessageIds,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobBatches.id, batchId));
  }

  async markBatchFailed(batchId: string, error: Error): Promise<void> {
    await this.database.db
      .update(jobBatches)
      .set({
        status: 'failed',
        errorMessage: error.message,
        updatedAt: new Date(),
      })
      .where(eq(jobBatches.id, batchId));
  }

  async lockPendingMessages(input: {
    batchId: string;
    groupId: string | null;
    topicId: string | null;
    periodStart: Date;
    periodEnd: Date;
    limit: number;
  }): Promise<string[]> {
    const filters: SQL[] = [
      eq(messages.processingStatus, 'pending'),
      gte(messages.sentAt, input.periodStart),
      lt(messages.sentAt, input.periodEnd),
    ];

    if (input.groupId) {
      filters.push(eq(messages.groupId, input.groupId));
    }

    if (input.topicId) {
      filters.push(eq(messages.topicId, input.topicId));
    }

    const candidates = await this.database.db
      .select({ id: messages.id })
      .from(messages)
      .where(and(...filters))
      .limit(input.limit);

    const ids = candidates.map((message) => message.id);
    if (ids.length === 0) {
      return [];
    }

    const locked = await this.database.db
      .update(messages)
      .set({
        processingStatus: 'processing',
        batchId: input.batchId,
        updatedAt: new Date(),
      })
      .where(inArray(messages.id, ids))
      .returning({ id: messages.id });

    return locked.map((message) => message.id);
  }

  async getMessagesByIds(messageIds: string[]): Promise<
    Array<{
      id: string;
      telegramMessageId: string;
      text: string | null;
      sentAt: Date;
      groupTitle: string | null;
      groupId: string;
      topicId: string | null;
      topicName: string | null;
      displayName: string | null;
      telegramUserId: string | null;
    }>
  > {
    if (messageIds.length === 0) {
      return [];
    }

    return this.database.db
      .select({
        id: messages.id,
        telegramMessageId: messages.telegramMessageId,
        text: messages.text,
        sentAt: messages.sentAt,
        groupId: messages.groupId,
        topicId: messages.topicId,
        groupTitle: telegramGroups.title,
        topicName: telegramTopics.name,
        displayName: telegramUsers.displayName,
        telegramUserId: telegramUsers.telegramUserId,
      })
      .from(messages)
      .innerJoin(telegramGroups, eq(messages.groupId, telegramGroups.id))
      .leftJoin(telegramTopics, eq(messages.topicId, telegramTopics.id))
      .leftJoin(telegramUsers, eq(messages.userId, telegramUsers.id))
      .where(inArray(messages.id, messageIds));
  }

  async resetFailedProcessingMessages(): Promise<number> {
    const reset = await this.database.db
      .update(messages)
      .set({
        processingStatus: 'pending',
        batchId: null,
        updatedAt: new Date(),
      })
      .where(eq(messages.processingStatus, 'failed'))
      .returning({ id: messages.id });

    return reset.length;
  }

  async markMessagesProcessed(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }

    await this.database.db
      .update(messages)
      .set({
        processingStatus: 'processed',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(messages.id, messageIds));
  }

  async clearOldAiRawResponses(before: Date): Promise<number> {
    const cleared = await this.database.db
      .update(aiRuns)
      .set({
        rawResponse: null,
      })
      .where(lt(aiRuns.createdAt, before))
      .returning({ id: aiRuns.id });

    return cleared.length;
  }

  async clearOldMessageRawPayloads(before: Date): Promise<number> {
    const cleared = await this.database.db
      .update(messages)
      .set({
        rawPayload: {},
        updatedAt: new Date(),
      })
      .where(and(lt(messages.createdAt, before), sql`${messages.rawPayload} <> '{}'::jsonb`))
      .returning({ id: messages.id });

    return cleared.length;
  }

  async deleteOldProcessedMessages(before: Date): Promise<number> {
    const deleted = await this.database.db
      .delete(messages)
      .where(and(eq(messages.processingStatus, 'processed'), lt(messages.createdAt, before)))
      .returning({ id: messages.id });

    return deleted.length;
  }

  async releaseMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }

    await this.database.db
      .update(messages)
      .set({
        processingStatus: 'pending',
        batchId: null,
        updatedAt: new Date(),
      })
      .where(inArray(messages.id, messageIds));
  }

  async listDailyReportReminderTargets(input: {
    since: Date;
    adminTelegramUserIds: string[];
  }): Promise<DailyReportReminderGroup[]> {
    const adminFilter = input.adminTelegramUserIds.length
      ? sql`and u.telegram_user_id not in (${sql.join(
          input.adminTelegramUserIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
    const result = await this.database.db.execute(sql`
      with group_members as (
        select distinct
          m.group_id,
          u.telegram_user_id,
          u.username,
          u.display_name
        from messages m
        inner join telegram_users u on u.id = m.user_id
        where 1 = 1 ${adminFilter}
      ),
      reporters_today as (
        select distinct m.group_id, u.telegram_user_id
        from messages m
        inner join telegram_users u on u.id = m.user_id
        where m.sent_at >= ${input.since}
      )
      select
        g.telegram_chat_id as "telegramChatId",
        g.title,
        gm.telegram_user_id as "telegramUserId",
        gm.username,
        gm.display_name as "displayName"
      from group_members gm
      inner join telegram_groups g on g.id = gm.group_id
      left join reporters_today rt
        on rt.group_id = gm.group_id
       and rt.telegram_user_id = gm.telegram_user_id
      where g.is_active = true
        and rt.telegram_user_id is null
      order by g.title nulls last, gm.display_name nulls last, gm.telegram_user_id
    `);

    const rows = (result as unknown as { rows: Array<{
      telegramChatId: string;
      title: string | null;
      telegramUserId: string;
      username: string | null;
      displayName: string | null;
    }> }).rows;
    const grouped = new Map<string, DailyReportReminderGroup>();

    for (const row of rows) {
      const group = grouped.get(row.telegramChatId) ?? {
        telegramChatId: row.telegramChatId,
        title: row.title,
        users: [],
      };
      group.users.push({
        telegramUserId: row.telegramUserId,
        username: row.username,
        displayName: row.displayName,
      });
      grouped.set(row.telegramChatId, group);
    }

    return Array.from(grouped.values());
  }
}
