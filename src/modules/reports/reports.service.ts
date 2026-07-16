import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { ReportFormatterService } from './report-formatter.service';
import { ReportsRepository } from './reports.repository';
import { ReportItem, StructuredReport } from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly formatter: ReportFormatterService,
    private readonly telegram: TelegramBotService,
  ) {}

  async generateBatchReports(input: {
    periodStart: Date;
    periodEnd: Date;
    groupId: string | null;
  }): Promise<{ generated: number; sent: number }> {
    const groups = input.groupId
      ? (await this.repository.listGroupsWithEvents(input.periodStart, input.periodEnd)).filter(
          (group) => group.id === input.groupId,
        )
      : await this.repository.listGroupsWithEvents(input.periodStart, input.periodEnd);

    let generated = 0;
    let sent = 0;

    for (const group of groups) {
      const result = await this.generateGroupReport({
        groupId: group.id,
        title: group.title ?? group.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        reportType: 'batch',
        telegramChatId: group.reportChatId,
        telegramThreadId: null,
      });
      generated += 1;
      if (result.sent) {
        sent += 1;
      }
    }

    return { generated, sent };
  }

  async generateGroupReport(input: {
    groupId: string;
    title: string;
    periodStart: Date;
    periodEnd: Date;
    reportType: string;
    telegramChatId: string | null;
    telegramThreadId: string | null;
    topicId?: string | null;
  }): Promise<{ content: string; reportId: string; sent: boolean }> {
    const items =
      input.topicId === undefined
        ? await this.repository.listReportItems({
            groupId: input.groupId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          })
        : await this.repository.listReportItemsForTopic({
            groupId: input.groupId,
            topicId: input.topicId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          });
    const structured = this.structure(items);
    const content = this.formatter.format({
      title: input.title,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      structured,
    });
    const reportId = await this.repository.upsertReport({
      groupId: input.groupId,
      reportType: input.reportType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      content,
      structuredContent: structured,
      telegramChatId: input.telegramChatId,
      telegramThreadId: input.telegramThreadId,
    });

    if (!input.telegramChatId) {
      return { content, reportId, sent: false };
    }

    let firstTelegramMessageId: number | null = null;
    for (const chunk of this.formatter.splitForTelegram(content)) {
      const telegramMessageId = await this.telegram.sendMessage(
        input.telegramChatId,
        chunk,
        input.telegramThreadId,
        'MarkdownV2',
      );
      firstTelegramMessageId ??= telegramMessageId;
    }
    await this.repository.markSent({
      reportId,
      telegramMessageId: firstTelegramMessageId === null ? null : String(firstTelegramMessageId),
    });

    return { content, reportId, sent: true };
  }

  private structure(items: ReportItem[]): StructuredReport {
    return {
      completed: items.filter((item) => item.eventType === 'task_completed'),
      inProgress: items.filter((item) => item.eventType === 'task_progress'),
      newTasks: items.filter((item) => item.eventType === 'task_created'),
      blockers: items.filter((item) => item.eventType === 'blocker'),
      decisions: items.filter((item) => item.eventType === 'decision'),
      needsReview: items.filter((item) => Number(item.confidence ?? 1) < 0.8),
      unassigned: items.filter((item) => item.taskId === null),
      byTopic: this.groupBy(items, (item) => item.topicName ?? 'General'),
      byUser: this.groupBy(
        items,
        (item) => item.actorDisplayName ?? item.assigneeDisplayName ?? 'Unknown',
      ),
    };
  }

  private groupBy(
    items: ReportItem[],
    getName: (item: ReportItem) => string,
  ): Array<{ name: string; items: ReportItem[] }> {
    const groups = new Map<string, ReportItem[]>();

    for (const item of items) {
      const name = getName(item);
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }

    return Array.from(groups.entries()).map(([name, groupedItems]) => ({
      name,
      items: groupedItems,
    }));
  }
}
