import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { ExtractionJob } from './extraction.job';
import { JOB_QUEUE_NAMES } from './jobs.constants';
import { JobPayloadService } from './job-payload.service';
import { JobData } from './jobs.types';
import { PgBossService } from './pg-boss.service';
import { ReportJob } from './report.job';
import { RetryFailedJob } from './retry-failed.job';
import { RetentionJob } from './retention.job';
import { AlertService } from './alert.service';

@Injectable()
export class JobWorkerService implements OnModuleInit {
  private readonly logger = new Logger(JobWorkerService.name);

  constructor(
    private readonly pgBoss: PgBossService,
    private readonly payloads: JobPayloadService,
    private readonly extractionJob: ExtractionJob,
    private readonly reportJob: ReportJob,
    private readonly retryFailedJob: RetryFailedJob,
    private readonly retentionJob: RetentionJob,
    private readonly alertService: AlertService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.app.processRole !== 'worker') {
      return;
    }

    await this.pgBoss.ensureStarted();

    await Promise.all([
      ...this.queueNamesFor(JOB_QUEUE_NAMES.extraction).map((queue) =>
        this.pgBoss.client.work<JobData>(queue, async ([job]) => {
          this.logger.log(`Running extraction job ${job.id}`);
          return this.extractionJob.handle(this.payloads.fromJobData(job.data, 'schedule'));
        }),
      ),
      ...this.queueNamesFor(JOB_QUEUE_NAMES.report).map((queue) =>
        this.pgBoss.client.work<JobData>(queue, async ([job]) => {
          this.logger.log(`Running report job ${job.id}`);
          return this.reportJob.handle(this.payloads.fromJobData(job.data, 'schedule'));
        }),
      ),
      this.pgBoss.client.work<JobData>(JOB_QUEUE_NAMES.retryFailed, async ([job]) => {
        this.logger.log(`Running retry failed job ${job.id}`);
        return this.retryFailedJob.handle();
      }),
      this.pgBoss.client.work<JobData>(JOB_QUEUE_NAMES.retention, async ([job]) => {
        this.logger.log(`Running retention job ${job.id}`);
        return this.retentionJob.handle();
      }),
      this.pgBoss.client.work<JobData>(JOB_QUEUE_NAMES.deadLetter, async ([job]) => {
        this.logger.error(`Dead-letter job received ${job.id}`);
        return this.alertService.jobFailed({
          jobId: job.id,
          queue: job.name,
          data: job.data,
        });
      }),
    ]);
  }

  private queueNamesFor(baseQueue: string): string[] {
    const schedules = (process.env.REPORT_SCHEDULES ?? '')
      .split(',')
      .map((schedule) => schedule.trim())
      .filter(Boolean);

    return [baseQueue, ...schedules.map((_, index) => `${baseQueue}.schedule.${index}`)];
  }
}
