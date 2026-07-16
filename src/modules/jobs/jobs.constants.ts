export const JOB_QUEUE_NAMES = {
  extraction: 'task-reporter.extraction',
  report: 'task-reporter.report',
  retryFailed: 'task-reporter.retry-failed',
  retention: 'task-reporter.retention',
  deadLetter: 'task-reporter.dead-letter',
} as const;

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[keyof typeof JOB_QUEUE_NAMES];

export const DEFAULT_JOB_WINDOW_HOURS = 6;
export const DEFAULT_JOB_BATCH_SIZE = 500;
