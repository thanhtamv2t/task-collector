export interface PeriodInput {
  periodStart?: string;
  periodEnd?: string;
  groupId?: string | null;
  topicId?: string | null;
}

export interface JobPayload {
  periodStart: string;
  periodEnd: string;
  groupId: string | null;
  topicId: string | null;
  requestedBy: 'manual' | 'schedule' | 'retry';
}

export type JobData = Partial<JobPayload>;

export interface JobTriggerResult {
  queue: string;
  jobId: string | null;
  payload: JobPayload;
}

export interface ExtractionJobResult {
  batchId: string;
  batchKey: string;
  lockedMessageCount: number;
  skipped: boolean;
}
