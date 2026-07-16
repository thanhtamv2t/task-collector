import { describe, expect, it, vi } from 'vitest';
import { RetentionJob } from '../src/modules/jobs/retention.job';

describe('RetentionJob', () => {
  it('uses separate retention windows for AI raw, message raw payload, and normalized messages', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    const repository = {
      clearOldAiRawResponses: vi.fn().mockResolvedValue(1),
      clearOldMessageRawPayloads: vi.fn().mockResolvedValue(2),
      deleteOldProcessedMessages: vi.fn().mockResolvedValue(3),
    };
    const job = new RetentionJob(repository as never, {
      aiRawResponseRetentionDays: 30,
      rawPayloadRetentionDays: 90,
      normalizedMessageRetentionDays: 180,
    } as never);

    await expect(job.handle()).resolves.toEqual({
      clearedAiRawResponses: 1,
      clearedMessageRawPayloads: 2,
      deletedMessages: 3,
    });

    expect(repository.clearOldAiRawResponses).toHaveBeenCalledWith(
      new Date('2026-06-15T12:00:00.000Z'),
    );
    expect(repository.clearOldMessageRawPayloads).toHaveBeenCalledWith(
      new Date('2026-04-16T12:00:00.000Z'),
    );
    expect(repository.deleteOldProcessedMessages).toHaveBeenCalledWith(
      new Date('2026-01-16T12:00:00.000Z'),
    );

    vi.useRealTimers();
  });
});
