import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { telegramConfig } from '../../config/telegram.config';
import { MessageChunkerService } from '../ai/message-chunker.service';
import { TaskExtractorService } from '../ai/task-extractor.service';
import { ExtractedEvent } from '../ai/schemas/extracted-event.schema';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { ReportFormatterService } from './report-formatter.service';
import { ReportsRepository } from './reports.repository';
import { ReportInsights, ReportItem, ReportMessage, StructuredReport } from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly formatter: ReportFormatterService,
    private readonly extractor: TaskExtractorService,
    private readonly chunker: MessageChunkerService,
    private readonly telegram: TelegramBotService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    @Inject(telegramConfig.KEY)
    private readonly telegramSettings: ConfigType<typeof telegramConfig>,
  ) {}

  async generateBatchReports(input: {
    periodStart: Date;
    periodEnd: Date;
    groupId: string | null;
    sendToTelegram?: boolean;
    notifyAdmins?: boolean;
  }): Promise<{ generated: number; sent: number }> {
    const groups = input.groupId
      ? (await this.repository.listGroupsWithMessages(input.periodStart, input.periodEnd)).filter(
          (group) => group.id === input.groupId,
        )
      : await this.repository.listGroupsWithMessages(input.periodStart, input.periodEnd);

    let generated = 0;
    let sent = 0;

    for (const group of groups) {
      const result = await this.generateGroupReport({
        groupId: group.id,
        title: group.title ?? group.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        reportType: 'batch',
        telegramChatId: input.sendToTelegram === true ? group.reportChatId : null,
        telegramThreadId: null,
        notifyAdmins: input.notifyAdmins === true,
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
    notifyAdmins?: boolean;
  }): Promise<{ content: string; reportId: string; sent: boolean }> {
    const messages = await this.repository.listReportMessages({
      groupId: input.groupId,
      topicId: input.topicId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
    const items = await this.evaluateMessages({
      groupId: input.groupId,
      topicId: input.topicId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      messages,
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

    if (input.notifyAdmins) {
      await this.notifyAdmins({
        reportId,
        title: input.title,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      });
    }

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

  private async notifyAdmins(input: {
    reportId: string;
    title: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    const baseUrl = this.app.dashboardUrl.replace(/\/$/, '');
    const link = `${baseUrl}/?reportId=${encodeURIComponent(input.reportId)}`;
    const message = [
      `Performance report created: ${input.title}`,
      `Period: ${input.periodStart.toISOString()} -> ${input.periodEnd.toISOString()}`,
      `View: ${link}`,
    ].join('\n');

    for (const adminId of this.telegramSettings.adminTelegramUserIds) {
      await this.telegram.sendMessage(adminId, message, null);
    }
  }

  private structure(items: ReportItem[]): StructuredReport {
    const byUser = this.groupBy(
      items,
      (item) => item.actorDisplayName ?? item.assigneeDisplayName ?? 'Unknown',
    );
    const completed = items.filter((item) => item.eventType === 'task_completed');
    const inProgress = items.filter((item) => item.eventType === 'task_progress');
    const blockers = items.filter((item) => item.eventType === 'blocker');
    const decisions = items.filter((item) => item.eventType === 'decision');

    return {
      insights: this.buildInsights({
        items,
        byUser,
        completed,
        inProgress,
        blockers,
        decisions,
      }),
      completed,
      inProgress,
      newTasks: items.filter((item) => item.eventType === 'task_created'),
      blockers,
      decisions,
      needsReview: items.filter((item) => Number(item.confidence ?? 1) < 0.8),
      unassigned: items.filter((item) => item.taskId === null),
      byTopic: this.groupBy(items, (item) => item.topicName ?? 'General'),
      byUser,
    };
  }

  private buildInsights(input: {
    items: ReportItem[];
    byUser: Array<{ name: string; items: ReportItem[] }>;
    completed: ReportItem[];
    inProgress: ReportItem[];
    blockers: ReportItem[];
    decisions: ReportItem[];
  }): ReportInsights {
    const memberInsights = input.byUser
      .map((group) => {
        const completed = group.items.filter((item) => item.eventType === 'task_completed').length;
        const progress = group.items.filter((item) => item.eventType === 'task_progress').length;
        const blockers = group.items.filter((item) => item.eventType === 'blocker').length;
        const decisions = group.items.filter((item) => item.eventType === 'decision').length;
        const score = completed * 3 + decisions * 2 + progress - blockers * 2;
        const signal =
          blockers > 0
            ? 'Có blocker cần gỡ'
            : completed >= 3
              ? 'Output tốt, nhiều hạng mục đã đóng'
              : completed > 0
                ? 'Có output hoàn thành'
                : progress > 2
                  ? 'Nhiều việc đang mở, cần close bớt'
                  : progress > 0
                    ? 'Có tiến độ nhưng chưa thấy output đóng'
                    : 'Ít tín hiệu performance';

        return {
          name: group.name,
          score,
          completed,
          progress,
          blockers,
          decisions,
          signal,
        };
      })
      .sort((left, right) => right.score - left.score || right.completed - left.completed);

    const topMembers = memberInsights.slice(0, 3).filter((member) => member.score > 0);
    const progressHeavy = memberInsights.filter(
      (member) => member.progress > member.completed && member.progress >= 2,
    );
    const blockedMembers = memberInsights.filter((member) => member.blockers > 0);
    const lowConfidenceCount = input.items.filter((item) => Number(item.confidence ?? 1) < 0.8).length;

    const summary =
      input.items.length === 0
        ? 'Không có daily report hợp lệ trong khoảng đã chọn.'
        : `${input.byUser.length} thành viên có report, ${input.completed.length} completed, ${input.inProgress.length} in-progress, ${input.blockers.length} blocker.`;

    const highlights =
      topMembers.length > 0
        ? topMembers.map(
            (member) =>
              `${member.name}: ${member.completed} completed, ${member.progress} progress (${member.signal}).`,
          )
        : ['Chưa thấy output hoàn thành rõ ràng trong khoảng này.'];

    const risks = [
      ...blockedMembers.map((member) => `${member.name}: ${member.blockers} blocker cần xử lý.`),
      ...progressHeavy.map(
        (member) => `${member.name}: nhiều progress hơn completed, nên review các việc chưa đóng.`,
      ),
      ...(lowConfidenceCount > 0 ? [`${lowConfidenceCount} item confidence thấp cần admin review.`] : []),
    ];

    const recommendations = [
      ...(progressHeavy.length > 0
        ? ['Yêu cầu member có nhiều progress cập nhật outcome/ETA rõ hơn ở report kế tiếp.']
        : []),
      ...(blockedMembers.length > 0 ? ['Ưu tiên gỡ blocker trước khi tạo thêm scope mới.'] : []),
      ...(input.completed.length === 0 && input.inProgress.length > 0
        ? ['Report hiện thiên về activity; cần hỏi rõ hạng mục nào đã hoàn thành.']
        : []),
      ...(input.items.length === 0
        ? ['Kiểm tra format daily report hoặc range report vì không có evidence hợp lệ.']
        : []),
    ];

    return {
      summary,
      highlights,
      risks: risks.length > 0 ? risks : ['Không thấy blocker/risk rõ ràng trong report.'],
      recommendations:
        recommendations.length > 0 ? recommendations : ['Tiếp tục tracking completion rate và blocker theo từng ngày.'],
      memberInsights,
    };
  }

  private async evaluateMessages(input: {
    groupId: string;
    topicId?: string | null;
    periodStart: Date;
    periodEnd: Date;
    messages: ReportMessage[];
  }): Promise<ReportItem[]> {
    const messageByTelegramId = new Map(
      input.messages.map((message) => [Number(message.telegramMessageId), message]),
    );
    const items: ReportItem[] = [];

    for (const chunk of this.chunker.chunk(
      input.messages.map((message) => ({
        groupId: message.groupId,
        topicId: message.topicId,
        telegramMessageId: Number(message.telegramMessageId),
        text: message.text ?? '',
        sentAt: message.sentAt.toISOString(),
        groupTitle: message.groupTitle,
        topicName: message.topicName,
        displayName: message.displayName,
        telegramUserId: message.telegramUserId,
      })),
    )) {
      const result = await this.extractor.extract({
        groupId: input.groupId,
        topicId: input.topicId ?? null,
        periodStart: input.periodStart.toISOString(),
        periodEnd: input.periodEnd.toISOString(),
        messages: chunk,
      });

      for (const event of result.output.events) {
        if (event.type === 'ignore') {
          continue;
        }
        items.push(this.eventToReportItem(event, messageByTelegramId));
      }
    }

    return items;
  }

  private eventToReportItem(
    event: ExtractedEvent,
    messageByTelegramId: Map<number, ReportMessage>,
  ): ReportItem {
    const sourceMessageIds = event.sourceMessageIds;
    const sourceMessage = sourceMessageIds.map((id) => messageByTelegramId.get(id)).find(Boolean) ?? null;
    const displayName =
      sourceMessage?.displayName ??
      (sourceMessage?.username ? `@${sourceMessage.username}` : null) ??
      sourceMessage?.telegramUserId ??
      'Unknown';

    return {
      taskId: null,
      taskTitle: event.title ?? event.summary,
      topicId: sourceMessage?.topicId ?? null,
      eventType: event.type,
      summary: event.summary,
      topicName: sourceMessage?.topicName ?? 'General',
      actorDisplayName: displayName,
      assigneeDisplayName: displayName,
      sourceMessageIds,
      confidence: event.confidence.toFixed(3),
      createdAt: sourceMessage?.sentAt ?? new Date(),
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
