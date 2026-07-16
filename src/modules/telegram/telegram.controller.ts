import { Body, Controller, Headers, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { telegramConfig } from '../../config/telegram.config';
import { CollectorService } from '../collector/collector.service';
import { TelegramUpdateParser } from './telegram-update.parser';

@Controller('webhooks/telegram')
export class TelegramController {
  constructor(
    private readonly parser: TelegramUpdateParser,
    private readonly collector: CollectorService,
    @Inject(telegramConfig.KEY)
    private readonly telegram: ConfigType<typeof telegramConfig>,
  ) {}

  @Post()
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: true; result: string }> {
    if (this.telegram.webhookSecret && secret !== this.telegram.webhookSecret) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    const message = this.parser.parse(body);
    if (!message) {
      return { ok: true, result: 'ignored' };
    }

    const result = await this.collector.collect(message);
    return { ok: true, result };
  }
}
