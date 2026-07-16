import { Injectable, Logger } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { JOB_QUEUE_NAMES } from './jobs.constants';
import { JobPayloadService } from './job-payload.service';
import { JobsRepository } from './jobs.repository';
import { JobPayload } from './jobs.types';

@Injectable()
export class ReportJob {
  private readonly logger = new Logger(ReportJob.name);

  constructor(
    private readonly repository: JobsRepository,
    private readonly payloads: JobPayloadService,
    private readonly reports: ReportsService,
  ) {}

  async handle(payload: JobPayload): Promise<{ batchId: string; skipped: boolean }> {
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);
    const batchKey = this.payloads.batchKey(JOB_QUEUE_NAMES.report, payload);
    const batch = await this.repository.ensureBatch({
      jobType: JOB_QUEUE_NAMES.report,
      batchKey,
      groupId: payload.groupId,
      topicId: payload.topicId,
      periodStart,
      periodEnd,
    });

    if (!batch.created) {
      this.logger.log(`Skipped duplicate report batch ${batchKey}`);
      return { batchId: batch.id, skipped: true };
    }

    await this.repository.markBatchRunning(batch.id);
    await this.reports.generateBatchReports({
      periodStart,
      periodEnd,
      groupId: payload.groupId,
      sendToTelegram: false,
      notifyAdmins: true,
    });
    await this.repository.markBatchCompleted(batch.id, []);

    return { batchId: batch.id, skipped: false };
  }
}
