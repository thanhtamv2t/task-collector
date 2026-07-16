import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as PgBoss from 'pg-boss';
import { databaseConfig } from '../../config/database.config';
import { JOB_QUEUE_NAMES, JobQueueName } from './jobs.constants';

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  private boss: PgBoss | null = null;
  private started = false;
  private starting: Promise<void> | null = null;

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly database: ConfigType<typeof databaseConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureStarted();
  }

  async ensureStarted(): Promise<void> {
    if (this.started) {
      return;
    }

    if (this.starting) {
      await this.starting;
      return;
    }

    this.starting = this.start();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async start(): Promise<void> {
    if (!this.database.url) {
      throw new Error('DATABASE_URL is required for pg-boss');
    }

    this.boss = new PgBoss({
      connectionString: this.database.url,
      application_name: 'telegram-task-reporter',
      schedule: true,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
    });

    this.boss.on('error', (error) => {
      this.logger.error(error.message, error.stack);
    });

    await this.boss.start();
    this.started = true;

    await this.ensureQueues();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss && this.started) {
      await this.boss.stop({ graceful: true, timeout: 5000, wait: true });
      this.started = false;
    }
  }

  get client(): PgBoss {
    if (!this.boss || !this.started) {
      throw new Error('pg-boss is not started');
    }

    return this.boss;
  }

  isReady(): boolean {
    return this.started;
  }

  async ping(): Promise<void> {
    await this.ensureStarted();
    await this.client.schemaVersion();
  }

  async send(queue: JobQueueName, data: object, singletonKey: string): Promise<string | null> {
    await this.ensureStarted();
    return this.client.send(queue, data, {
      singletonKey,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      deadLetter: JOB_QUEUE_NAMES.deadLetter,
    });
  }

  private async ensureQueues(): Promise<void> {
    if (!this.boss || !this.started) {
      throw new Error('pg-boss is not started');
    }

    await this.boss.createQueue(JOB_QUEUE_NAMES.deadLetter, {
      name: JOB_QUEUE_NAMES.deadLetter,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
    });

    for (const name of Object.values(JOB_QUEUE_NAMES).filter(
      (queueName) => queueName !== JOB_QUEUE_NAMES.deadLetter,
    )) {
      await this.boss.createQueue(name, {
        name,
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
        deadLetter: JOB_QUEUE_NAMES.deadLetter,
      });
    }
  }
}
