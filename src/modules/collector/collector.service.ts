import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { telegramConfig } from '../../config/telegram.config';
import { ReportsService } from '../reports/reports.service';
import { TasksService } from '../tasks/tasks.service';
import { NormalizedTelegramMessage } from '../telegram/telegram.types';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { CollectorRepository } from './collector.repository';

type CollectorResult =
  | 'ignored'
  | 'command_handled'
  | 'stored'
  | 'duplicate'
  | 'unregistered_group'
  | 'unmonitored_topic';

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    private readonly repository: CollectorRepository,
    private readonly bot: TelegramBotService,
    private readonly reports: ReportsService,
    private readonly tasks: TasksService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    @Inject(telegramConfig.KEY)
    private readonly telegram: ConfigType<typeof telegramConfig>,
  ) {}

  async collect(message: NormalizedTelegramMessage): Promise<CollectorResult> {
    if (!['group', 'supergroup'].includes(message.chatType)) {
      return 'ignored';
    }

    if (message.from?.isBot) {
      return 'ignored';
    }

    if (message.text.startsWith('/')) {
      await this.handleCommand(message);
      return 'command_handled';
    }

    const group = await this.repository.findGroupByChatId(message.chatId);
    if (!group?.isActive) {
      this.logger.debug(`Ignored message from unregistered group ${message.chatId}`);
      return 'unregistered_group';
    }

    const topic = await this.repository.findTopic(group.id, message.threadId);
    if (!topic?.isMonitored) {
      return 'unmonitored_topic';
    }

    const user = await this.repository.upsertUser(message);
    const inserted = await this.repository.saveMessage({
      message,
      groupId: group.id,
      topicId: topic.id,
      userId: user?.id ?? null,
    });

    return inserted ? 'stored' : 'duplicate';
  }

  private async handleCommand(message: NormalizedTelegramMessage): Promise<void> {
    const parts = message.text.split(/\s+/).filter(Boolean);
    const command = parts[0]?.split('@')[0];
    const args = parts.slice(1);

    if (!this.isAdmin(message)) {
      await this.bot.sendMessage(message.chatId, 'Permission denied.', message.threadId);
      return;
    }

    switch (command) {
      case '/setup':
        await this.setup(message);
        break;
      case '/topics':
        await this.topics(message);
        break;
      case '/watch':
        await this.watch(message, true);
        break;
      case '/unwatch':
        await this.watch(message, false);
        break;
      case '/settings':
        await this.settings(message);
        break;
      case '/report':
        await this.report(message, false);
        break;
      case '/report_today':
        await this.report(message, true);
        break;
      case '/tasks':
        await this.tasksList(message);
        break;
      case '/done':
        await this.done(message, args);
        break;
      case '/assign':
        await this.assign(message, args);
        break;
      case '/help':
        await this.help(message);
        break;
      default:
        await this.help(message);
    }
  }

  private isAdmin(message: NormalizedTelegramMessage): boolean {
    if (!message.from) {
      return false;
    }

    return this.telegram.adminTelegramUserIds.includes(message.from.telegramUserId);
  }

  private async setup(message: NormalizedTelegramMessage): Promise<void> {
    await this.repository.upsertGroup({
      chatId: message.chatId,
      title: message.chatTitle,
      timezone: this.app.timezone,
    });

    await this.bot.sendMessage(message.chatId, 'Group registered.', message.threadId);
  }

  private async topics(message: NormalizedTelegramMessage): Promise<void> {
    const group = await this.repository.findGroupByChatId(message.chatId);

    if (!group) {
      await this.bot.sendMessage(message.chatId, 'Run /setup first.', message.threadId);
      return;
    }

    const topics = await this.repository.listTopics(group.id);
    const content =
      topics.length === 0
        ? 'No topics discovered yet. Run /watch inside a topic to add it.'
        : topics
            .map((topic) => {
              const status = topic.isMonitored ? 'watching' : 'paused';
              return `thread=${topic.telegramThreadId ?? 'general'} status=${status}`;
            })
            .join('\n');

    await this.bot.sendMessage(message.chatId, content, message.threadId);
  }

  private async watch(message: NormalizedTelegramMessage, isMonitored: boolean): Promise<void> {
    const group = await this.repository.findGroupByChatId(message.chatId);

    if (!group) {
      await this.bot.sendMessage(message.chatId, 'Run /setup first.', message.threadId);
      return;
    }

    await this.repository.upsertTopic({
      groupId: group.id,
      threadId: message.threadId,
      name: message.threadId ? `Topic ${message.threadId}` : 'General',
      isMonitored,
    });

    await this.bot.sendMessage(
      message.chatId,
      isMonitored ? 'Topic is now watched.' : 'Topic is now paused.',
      message.threadId,
    );
  }

  private async settings(message: NormalizedTelegramMessage): Promise<void> {
    const group = await this.repository.findGroupByChatId(message.chatId);

    if (!group) {
      await this.bot.sendMessage(message.chatId, 'Run /setup first.', message.threadId);
      return;
    }

    const topics = await this.repository.listTopics(group.id);
    const watchedCount = topics.filter((topic) => topic.isMonitored).length;
    await this.bot.sendMessage(
      message.chatId,
      [
        `Group: ${group.title ?? message.chatTitle ?? message.chatId}`,
        `Chat ID: ${group.telegramChatId}`,
        `Timezone: ${group.timezone}`,
        `Active: ${group.isActive ? 'yes' : 'no'}`,
        `Topics: ${watchedCount}/${topics.length} watched`,
      ].join('\n'),
      message.threadId,
    );
  }

  private async report(message: NormalizedTelegramMessage, todayOnly: boolean): Promise<void> {
    const group = await this.repository.findGroupByChatId(message.chatId);

    if (!group) {
      await this.bot.sendMessage(message.chatId, 'Run /setup first.', message.threadId);
      return;
    }

    const periodEnd = new Date();
    const periodStart = todayOnly
      ? this.startOfTodayInTimezone(periodEnd, this.app.timezone)
      : new Date(periodEnd.getTime() - 6 * 60 * 60 * 1000);
    const topic =
      message.threadId === null ? null : await this.repository.findTopic(group.id, message.threadId);

    await this.reports.generateGroupReport({
      groupId: group.id,
      title: group.title ?? message.chatTitle ?? message.chatId,
      periodStart,
      periodEnd,
      reportType: todayOnly ? 'today' : 'manual',
      telegramChatId: message.chatId,
      telegramThreadId: message.threadId,
      topicId: message.threadId === null ? undefined : topic?.id,
    });
  }

  private async tasksList(message: NormalizedTelegramMessage): Promise<void> {
    const group = await this.repository.findGroupByChatId(message.chatId);

    if (!group) {
      await this.bot.sendMessage(message.chatId, 'Run /setup first.', message.threadId);
      return;
    }

    const topic = await this.repository.findTopic(group.id, message.threadId);
    const tasks = await this.tasks.listOpenTasks({
      groupId: group.id,
      topicId: topic?.id ?? null,
    });

    const content =
      tasks.length === 0
        ? 'No open tasks.'
        : tasks
            .map((task) => {
              const due = task.dueDate ? ` due=${task.dueDate.toISOString()}` : '';
              const priority = task.priority ? ` priority=${task.priority}` : '';
              return `- ${task.title} status=${task.status}${priority}${due}`;
            })
            .join('\n');

    await this.bot.sendMessage(message.chatId, content, message.threadId);
  }

  private async done(message: NormalizedTelegramMessage, args: string[]): Promise<void> {
    const taskId = args[0];
    if (!taskId) {
      await this.bot.sendMessage(message.chatId, 'Usage: /done <task-id>', message.threadId);
      return;
    }

    const context = await this.commandContext(message);
    if (!context) {
      return;
    }

    const marked = await this.tasks.markDone({
      taskId,
      groupId: context.group.id,
      topicId: context.topicId,
      actorTelegramUserId: message.from?.telegramUserId ?? null,
      sourceMessageId: Number(message.telegramMessageId),
    });

    await this.bot.sendMessage(
      message.chatId,
      marked ? 'Task marked done.' : 'Task not found.',
      message.threadId,
    );
  }

  private async assign(message: NormalizedTelegramMessage, args: string[]): Promise<void> {
    const [taskId, username] = args;
    if (!taskId || !username) {
      await this.bot.sendMessage(message.chatId, 'Usage: /assign <task-id> @username', message.threadId);
      return;
    }

    const context = await this.commandContext(message);
    if (!context) {
      return;
    }

    const result = await this.tasks.assign({
      taskId,
      username,
      groupId: context.group.id,
      topicId: context.topicId,
      actorTelegramUserId: message.from?.telegramUserId ?? null,
      sourceMessageId: Number(message.telegramMessageId),
    });

    const response =
      result === 'assigned'
        ? 'Task assigned.'
        : result === 'user_not_found'
          ? 'User not found. They need to send at least one message first.'
          : 'Task not found.';

    await this.bot.sendMessage(message.chatId, response, message.threadId);
  }

  private async help(message: NormalizedTelegramMessage): Promise<void> {
    await this.bot.sendMessage(
      message.chatId,
      [
        'Commands:',
        '/setup',
        '/topics',
        '/watch',
        '/unwatch',
        '/settings',
        '/report',
        '/report_today',
        '/tasks',
        '/done <task-id>',
        '/assign <task-id> @username',
        '/help',
      ].join('\n'),
      message.threadId,
    );
  }

  private async commandContext(message: NormalizedTelegramMessage): Promise<{
    group: NonNullable<Awaited<ReturnType<CollectorRepository['findGroupByChatId']>>>;
    topicId: string | null;
  } | null> {
    const group = await this.repository.findGroupByChatId(message.chatId);

    if (!group) {
      await this.bot.sendMessage(message.chatId, 'Run /setup first.', message.threadId);
      return null;
    }

    const topic = await this.repository.findTopic(group.id, message.threadId);
    return {
      group,
      topicId: topic?.id ?? null,
    };
  }

  private startOfTodayInTimezone(now: Date, timezone: string): Date {
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
    const offset = this.timezoneOffsetMillis(localMidnight, timezone);
    return new Date(localMidnight.getTime() - offset);
  }

  private timezoneOffsetMillis(date: Date, timezone: string): number {
    const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const zoned = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return zoned.getTime() - utc.getTime();
  }
}
