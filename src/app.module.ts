import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { aiConfig } from './config/ai.config';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { telegramConfig } from './config/telegram.config';
import { validateEnv } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InternalModule } from './modules/internal/internal.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, telegramConfig, aiConfig],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: [
          'req.headers.authorization',
          'req.headers.x-admin-token',
          'req.headers.x-telegram-bot-api-secret-token',
        ],
        genReqId: (request: IncomingMessage, response: ServerResponse) => {
          const header = request.headers['x-request-id'];
          const requestId = Array.isArray(header) ? (header[0] ?? randomUUID()) : (header ?? randomUUID());
          response.setHeader('x-request-id', requestId);
          return requestId;
        },
        customProps: (request: IncomingMessage) => ({
          request_id: request.id,
        }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              },
      },
    }),
    DatabaseModule,
    AuthModule,
    JobsModule,
    HealthModule,
    InternalModule,
    TelegramModule,
  ],
})
export class AppModule {}
