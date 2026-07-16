import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { telegramConfig } from '../../config/telegram.config';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class DailyReportReminderJob {
  private readonly logger = new Logger(DailyReportReminderJob.name);

  constructor(
    private readonly repository: JobsRepository,
    private readonly bot: TelegramBotService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    @Inject(telegramConfig.KEY)
    private readonly telegram: ConfigType<typeof telegramConfig>,
  ) {}

  async handle(): Promise<{
    groups: number;
    remindedUsers: number;
    failedGroups: Array<{ telegramChatId: string; title: string | null; error: string }>;
  }> {
    const now = new Date();
    const since = this.startOfLocalDay(now, this.app.timezone);
    const groups = await this.repository.listDailyReportReminderTargets({
      since,
      adminTelegramUserIds: this.telegram.adminTelegramUserIds,
    });

    let remindedUsers = 0;
    const failedGroups: Array<{ telegramChatId: string; title: string | null; error: string }> = [];
    for (const group of groups) {
      if (group.users.length === 0) {
        continue;
      }

      const mentions = group.users.map((user) => this.mention(user)).join(' ');
      try {
        await this.bot.sendMessage(
          group.telegramChatId,
          `Nhắc daily report sau 21:00: ${mentions}\nBạn chưa gửi daily report hôm nay.`,
          null,
          'MarkdownV2',
        );
        remindedUsers += group.users.length;
        this.logger.log(`Reminded ${group.users.length} user(s) in group ${group.telegramChatId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Telegram send failed';
        failedGroups.push({ telegramChatId: group.telegramChatId, title: group.title, error: message });
        this.logger.error(`Failed to remind group ${group.telegramChatId}: ${message}`);
      }
    }

    return { groups: groups.length, remindedUsers, failedGroups };
  }

  private mention(user: {
    telegramUserId: string;
    username: string | null;
    displayName: string | null;
  }): string {
    if (user.username) {
      return `@${this.escape(user.username)}`;
    }

    return `[${this.escape(user.displayName ?? user.telegramUserId)}](tg://user?id=${user.telegramUserId})`;
  }

  private escape(value: string): string {
    return value.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }

  private startOfLocalDay(now: Date, timezone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) {
      return new Date(now);
    }

    const localMidnight = new Date(`${year}-${month}-${day}T00:00:00.000`);
    const utc = new Date(localMidnight.toLocaleString('en-US', { timeZone: 'UTC' }));
    const zoned = new Date(localMidnight.toLocaleString('en-US', { timeZone: timezone }));
    return new Date(localMidnight.getTime() - (zoned.getTime() - utc.getTime()));
  }
}
