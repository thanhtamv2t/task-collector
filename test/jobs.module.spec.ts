import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigModule } from '@nestjs/config';
import { aiConfig } from '../src/config/ai.config';
import { appConfig } from '../src/config/app.config';
import { databaseConfig } from '../src/config/database.config';
import { telegramConfig } from '../src/config/telegram.config';
import { JobsModule } from '../src/modules/jobs/jobs.module';

describe('JobsModule', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://telegram_reporter:password@localhost:5432/telegram_reporter';
    process.env.PROCESS_ROLE = 'api';
    process.env.TELEGRAM_BOT_TOKEN = '';
  });

  it('compiles all job providers and their dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, databaseConfig, telegramConfig, aiConfig],
        }),
        JobsModule,
      ],
    }).compile();

    expect(moduleRef).toBeTruthy();
    await moduleRef.close();
  });
});
