import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { aiConfig } from '../../config/ai.config';
import { telegramConfig } from '../../config/telegram.config';
import { DatabaseService } from '../../database/database.service';
import { PgBossService } from '../jobs/pg-boss.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly pgBoss: PgBossService,
    @Inject(telegramConfig.KEY)
    private readonly telegram: ConfigType<typeof telegramConfig>,
    @Inject(aiConfig.KEY)
    private readonly ai: ConfigType<typeof aiConfig>,
  ) {}

  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{
    status: 'ok';
    checks: Record<string, boolean>;
  }> {
    await this.database.ping();
    await this.pgBoss.ping();

    return {
      status: 'ok',
      checks: {
        postgres: true,
        pgBoss: this.pgBoss.isReady(),
        telegramBotConfigured: this.telegram.botToken.length > 0,
        openRouterConfigured: this.ai.apiKey.length > 0,
      },
    };
  }
}
