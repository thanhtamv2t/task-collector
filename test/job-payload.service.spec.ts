import { describe, expect, it, vi } from 'vitest';
import { JOB_QUEUE_NAMES } from '../src/modules/jobs/jobs.constants';
import { JobPayloadService } from '../src/modules/jobs/job-payload.service';

describe('JobPayloadService', () => {
  const service = new JobPayloadService();

  it('builds a deterministic batch key from queue, scope, and period', () => {
    const payload = service.build(
      {
        groupId: 'group-1',
        topicId: 'topic-1',
        periodStart: '2026-07-15T01:00:00.000Z',
        periodEnd: '2026-07-15T02:00:00.000Z',
      },
      'manual',
    );

    expect(service.batchKey(JOB_QUEUE_NAMES.extraction, payload)).toBe(
      'task-reporter.extraction:group-1:topic-1:2026-07-15T01:00:00.000Z:2026-07-15T02:00:00.000Z',
    );
  });

  it('defaults manual job windows to the last six hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T08:00:00.000Z'));

    const payload = service.build({}, 'manual');

    expect(payload.periodStart).toBe('2026-07-15T02:00:00.000Z');
    expect(payload.periodEnd).toBe('2026-07-15T08:00:00.000Z');
    expect(payload.requestedBy).toBe('manual');

    vi.useRealTimers();
  });

  it('rejects invalid periods', () => {
    expect(() =>
      service.build(
        {
          periodStart: '2026-07-15T03:00:00.000Z',
          periodEnd: '2026-07-15T02:00:00.000Z',
        },
        'manual',
      ),
    ).toThrow('periodStart must be before periodEnd');
  });
});
