import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrapWorker(): Promise<void> {
  process.env.PROCESS_ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  const logger = new Logger('Worker');

  logger.log('Worker started. Job queue implementation begins in Milestone 2.');

  process.on('SIGTERM', () => {
    void app.close();
  });
}

void bootstrapWorker();
