import { Injectable } from '@nestjs/common';
import { DEFAULT_JOB_WINDOW_HOURS, DEFAULT_REPORT_WINDOW_HOURS, JOB_QUEUE_NAMES, JobQueueName } from './jobs.constants';
import { JobPayloadService } from './job-payload.service';
import { PgBossService } from './pg-boss.service';
import { JobPayload, JobTriggerResult, PeriodInput } from './jobs.types';

@Injectable()
export class JobTriggerService {
  constructor(
    private readonly payloads: JobPayloadService,
    private readonly pgBoss: PgBossService,
  ) {}

  async triggerExtraction(input: PeriodInput, requestedBy: JobPayload['requestedBy'] = 'manual') {
    return this.trigger(JOB_QUEUE_NAMES.extraction, input, requestedBy);
  }

  async triggerReport(input: PeriodInput, requestedBy: JobPayload['requestedBy'] = 'manual') {
    return this.trigger(JOB_QUEUE_NAMES.report, input, requestedBy);
  }

  async triggerRetryFailed(): Promise<JobTriggerResult> {
    const payload = this.payloads.build({}, 'retry');
    const jobId = await this.pgBoss.send(
      JOB_QUEUE_NAMES.retryFailed,
      payload,
      this.payloads.batchKey(JOB_QUEUE_NAMES.retryFailed, payload),
    );

    return {
      queue: JOB_QUEUE_NAMES.retryFailed,
      jobId,
      payload,
    };
  }

  async triggerRetention(): Promise<JobTriggerResult> {
    const payload = this.payloads.build({}, 'manual');
    const jobId = await this.pgBoss.send(
      JOB_QUEUE_NAMES.retention,
      payload,
      this.payloads.batchKey(JOB_QUEUE_NAMES.retention, payload),
    );

    return {
      queue: JOB_QUEUE_NAMES.retention,
      jobId,
      payload,
    };
  }

  private async trigger(
    queue: JobQueueName,
    input: PeriodInput,
    requestedBy: JobPayload['requestedBy'],
  ): Promise<JobTriggerResult> {
    const payload = this.payloads.build(
      input,
      requestedBy,
      queue === JOB_QUEUE_NAMES.report ? DEFAULT_REPORT_WINDOW_HOURS : DEFAULT_JOB_WINDOW_HOURS,
    );
    const jobId = await this.pgBoss.send(queue, payload, this.payloads.batchKey(queue, payload));

    return {
      queue,
      jobId,
      payload,
    };
  }
}
