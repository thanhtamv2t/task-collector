import { describe, expect, it } from 'vitest';
import { TelegramBotService } from '../src/modules/telegram/telegram-bot.service';
import { ReportFormatterService } from '../src/modules/reports/report-formatter.service';
import { ReportsRepository } from '../src/modules/reports/reports.repository';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ReportItem } from '../src/modules/reports/reports.types';

class FakeReportsRepository {
  readonly sentReports: Array<{ reportId: string; telegramMessageId: string | null }> = [];

  async listReportItems(): Promise<ReportItem[]> {
    return [
      {
        taskId: 'task-1',
        taskTitle: 'Finish report test',
        topicId: 'topic-1',
        eventType: 'task_completed',
        summary: 'A report test task was completed.',
        topicName: 'Backend',
        actorDisplayName: 'Alice',
        assigneeDisplayName: 'Alice',
        sourceMessageIds: [1002],
        confidence: '0.900',
        createdAt: new Date('2026-07-15T01:00:00.000Z'),
      },
    ];
  }

  async listReportItemsForTopic(): Promise<ReportItem[]> {
    return this.listReportItems();
  }

  async upsertReport(): Promise<string> {
    return 'report-1';
  }

  async markSent(input: { reportId: string; telegramMessageId: string | null }): Promise<void> {
    this.sentReports.push(input);
  }
}

class FakeTelegramBotService {
  readonly messages: string[] = [];

  async sendMessage(_chatId: string, text: string): Promise<number> {
    this.messages.push(text);
    return this.messages.length;
  }
}

describe('ReportsService', () => {
  it('generates, stores, and sends a group report', async () => {
    const repository = new FakeReportsRepository();
    const bot = new FakeTelegramBotService();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
      new ReportFormatterService(),
      bot as unknown as TelegramBotService,
    );

    const result = await service.generateGroupReport({
      groupId: 'group-1',
      title: 'Engineering',
      periodStart: new Date('2026-07-15T00:00:00.000Z'),
      periodEnd: new Date('2026-07-15T06:00:00.000Z'),
      reportType: 'manual',
      telegramChatId: '-1001',
      telegramThreadId: '7',
      topicId: 'topic-1',
    });

    expect(result.sent).toBe(true);
    expect(bot.messages[0]).toContain('Finish report test');
    expect(repository.sentReports).toEqual([{ reportId: 'report-1', telegramMessageId: '1' }]);
  });
});
