import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { JOB_QUEUE_NAMES } from './jobs.constants';
import { JobPayloadService } from './job-payload.service';
import { PgBossService } from './pg-boss.service';

@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    private readonly payloads: JobPayloadService,
    private readonly pgBoss: PgBossService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.app.processRole !== 'worker') {
      return;
    }

    await this.pgBoss.ensureStarted();

    const schedules = (process.env.REPORT_SCHEDULES ?? '')
      .split(',')
      .map((schedule) => schedule.trim())
      .filter(Boolean);

    await Promise.all(
      schedules.map(async (cron, index) => {
        const extractionQueue = `${JOB_QUEUE_NAMES.extraction}.schedule.${index}`;
        const reportQueue = `${JOB_QUEUE_NAMES.report}.schedule.${index}`;

        await this.pgBoss.client.createQueue(extractionQueue, { name: extractionQueue });
        await this.pgBoss.client.createQueue(reportQueue, { name: reportQueue });

        await this.pgBoss.client.schedule(
          extractionQueue,
          cron,
          { requestedBy: 'schedule' },
          { tz: this.app.timezone },
        );
        await this.pgBoss.client.schedule(reportQueue, cron, { requestedBy: 'schedule' }, {
          tz: this.app.timezone,
        });
      }),
    );

    await this.pgBoss.client.schedule(
      JOB_QUEUE_NAMES.retention,
      '0 3 * * *',
      { requestedBy: 'schedule' },
      { tz: this.app.timezone },
    );

    this.logger.log(`Registered ${schedules.length} report schedules`);
  }
}
