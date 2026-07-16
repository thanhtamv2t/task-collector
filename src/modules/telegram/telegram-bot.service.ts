import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Bot } from 'grammy';
import { telegramConfig } from '../../config/telegram.config';

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly bot: Bot | null;

  constructor(
    @Inject(telegramConfig.KEY)
    telegram: ConfigType<typeof telegramConfig>,
  ) {
    this.bot = telegram.botToken ? new Bot(telegram.botToken) : null;
  }

  async sendMessage(
    chatId: string,
    text: string,
    threadId: string | null,
    parseMode?: 'MarkdownV2',
  ): Promise<number | null> {
    if (!this.bot) {
      this.logger.warn(`Telegram bot token is not configured. Skipped message: ${text}`);
      return null;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const message = await this.bot.api.sendMessage(chatId, text, {
          message_thread_id: threadId === null ? undefined : Number(threadId),
          parse_mode: parseMode,
        });
        return message.message_id;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Telegram send failed');
        if (attempt < 3) {
          await this.sleep(250 * 2 ** (attempt - 1));
        }
      }
    }

    throw lastError ?? new Error('Telegram send failed');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
