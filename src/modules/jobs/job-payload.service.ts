import { Injectable } from '@nestjs/common';
import { DEFAULT_JOB_WINDOW_HOURS, JobQueueName } from './jobs.constants';
import { JobData, JobPayload, PeriodInput } from './jobs.types';

@Injectable()
export class JobPayloadService {
  build(input: PeriodInput, requestedBy: JobPayload['requestedBy']): JobPayload {
    const periodEnd = input.periodEnd ? new Date(input.periodEnd) : new Date();
    const periodStart = input.periodStart
      ? new Date(input.periodStart)
      : new Date(periodEnd.getTime() - DEFAULT_JOB_WINDOW_HOURS * 60 * 60 * 1000);

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new Error('Invalid periodStart or periodEnd');
    }

    if (periodStart >= periodEnd) {
      throw new Error('periodStart must be before periodEnd');
    }

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      groupId: input.groupId ?? null,
      topicId: input.topicId ?? null,
      requestedBy,
    };
  }

  fromJobData(data: JobData | undefined, fallbackRequestedBy: JobPayload['requestedBy']): JobPayload {
    return this.build(data ?? {}, data?.requestedBy ?? fallbackRequestedBy);
  }

  batchKey(queue: JobQueueName, payload: JobPayload): string {
    return [
      queue,
      payload.groupId ?? 'all-groups',
      payload.topicId ?? 'all-topics',
      payload.periodStart,
      payload.periodEnd,
    ].join(':');
  }
}
