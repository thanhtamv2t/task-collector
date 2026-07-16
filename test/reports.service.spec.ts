import { describe, expect, it } from 'vitest';
import { TelegramBotService } from '../src/modules/telegram/telegram-bot.service';
import { ReportFormatterService } from '../src/modules/reports/report-formatter.service';
import { ReportsRepository } from '../src/modules/reports/reports.repository';
import { ReportsService } from '../src/modules/reports/reports.service';

class FakeReportsRepository {
  readonly sentReports: Array<{ reportId: string; telegramMessageId: string | null }> = [];

  async listReportMessages() {
    return [
      {
        groupId: 'group-1',
        topicId: 'topic-1',
        telegramMessageId: '1002',
        text: 'Đã hoàn thành report test.',
        sentAt: new Date('2026-07-15T01:00:00.000Z'),
        groupTitle: 'Engineering',
        topicName: 'Backend',
        displayName: 'Alice',
        username: 'alice',
        telegramUserId: '42',
      },
    ];
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

class FakeExtractor {
  async extract() {
    return {
      aiRunId: 'ai-run-1',
      skipped: false,
      output: {
        events: [
          {
            type: 'task_completed',
            title: 'Report test',
            summary: 'Đã hoàn thành report test.',
            assigneeTelegramUserId: '42',
            confidence: 0.9,
            sourceMessageIds: [1002],
          },
        ],
      },
    };
  }
}

class FakeChunker {
  chunk<T>(items: T[]): T[][] {
    return [items];
  }
}

describe('ReportsService', () => {
  it('generates, stores, and sends a group report', async () => {
    const repository = new FakeReportsRepository();
    const bot = new FakeTelegramBotService();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
      new ReportFormatterService(),
      new FakeExtractor() as never,
      new FakeChunker() as never,
      bot as unknown as TelegramBotService,
      { dashboardUrl: 'https://task.orokucode.com' } as never,
      { adminTelegramUserIds: [] } as never,
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
    expect(bot.messages[0]).toContain('Đã hoàn thành report test');
    expect(repository.sentReports).toEqual([{ reportId: 'report-1', telegramMessageId: '1' }]);
  });
});
