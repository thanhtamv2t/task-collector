import { Injectable } from '@nestjs/common';
import { and, eq, gte, lt } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  reports,
  taskEvents,
  tasks,
  telegramGroups,
  telegramTopics,
  telegramUsers,
} from '../../database/schema';
import { ReportItem } from './reports.types';

@Injectable()
export class ReportsRepository {
  constructor(private readonly database: DatabaseService) {}

  async listGroupsWithEvents(periodStart: Date, periodEnd: Date): Promise<Array<{ id: string; title: string | null; reportChatId: string | null }>> {
    return this.database.db
      .selectDistinct({
        id: telegramGroups.id,
        title: telegramGroups.title,
        reportChatId: telegramGroups.reportChatId,
      })
      .from(taskEvents)
      .innerJoin(telegramGroups, eq(taskEvents.groupId, telegramGroups.id))
      .where(and(gte(taskEvents.createdAt, periodStart), lt(taskEvents.createdAt, periodEnd)));
  }

  async listReportItems(input: {
    groupId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<ReportItem[]> {
    const rows = await this.database.db
      .select({
        taskId: taskEvents.taskId,
        taskTitle: tasks.title,
        topicId: taskEvents.topicId,
        eventType: taskEvents.eventType,
        summary: taskEvents.summary,
        topicName: telegramTopics.name,
        actorDisplayName: telegramUsers.displayName,
        assigneeDisplayName: telegramUsers.displayName,
        sourceMessageIds: taskEvents.sourceMessageIds,
        confidence: taskEvents.aiConfidence,
        createdAt: taskEvents.createdAt,
      })
      .from(taskEvents)
      .leftJoin(tasks, eq(taskEvents.taskId, tasks.id))
      .leftJoin(telegramTopics, eq(taskEvents.topicId, telegramTopics.id))
      .leftJoin(telegramUsers, eq(taskEvents.actorUserId, telegramUsers.id))
      .where(
        and(
          eq(taskEvents.groupId, input.groupId),
          gte(taskEvents.createdAt, input.periodStart),
          lt(taskEvents.createdAt, input.periodEnd),
        ),
      );

    return rows.map((row) => ({
      ...row,
      sourceMessageIds: Array.isArray(row.sourceMessageIds)
        ? (row.sourceMessageIds as number[])
        : [],
    }));
  }

  async listReportItemsForTopic(input: {
    groupId: string;
    topicId: string | null;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<ReportItem[]> {
    const items = await this.listReportItems({
      groupId: input.groupId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });

    return items.filter((item) => item.topicId === input.topicId);
  }

  async upsertReport(input: {
    groupId: string;
    reportType: string;
    periodStart: Date;
    periodEnd: Date;
    content: string;
    structuredContent: unknown;
    telegramChatId: string | null;
    telegramThreadId?: string | null;
  }): Promise<string> {
    const [report] = await this.database.db
      .insert(reports)
      .values({
        groupId: input.groupId,
        reportType: input.reportType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        content: input.content,
        structuredContent: input.structuredContent,
        telegramChatId: input.telegramChatId,
        telegramThreadId: input.telegramThreadId,
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: [reports.groupId, reports.reportType, reports.periodStart, reports.periodEnd],
        set: {
          content: input.content,
          structuredContent: input.structuredContent,
          telegramChatId: input.telegramChatId,
          telegramThreadId: input.telegramThreadId,
          status: 'pending',
        },
      })
      .returning({ id: reports.id });

    if (!report) {
      throw new Error('Failed to upsert report');
    }

    return report.id;
  }

  async markSent(input: { reportId: string; telegramMessageId: string | null }): Promise<void> {
    await this.database.db
      .update(reports)
      .set({
        status: 'sent',
        sentAt: new Date(),
        telegramMessageId: input.telegramMessageId,
      })
      .where(eq(reports.id, input.reportId));
  }
}
