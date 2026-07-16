import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InternalMetricsController } from '../src/modules/internal/internal.controller';

describe('InternalMetricsController', () => {
  it('returns a metrics snapshot through the internal metrics service', async () => {
    const snapshot = vi.fn().mockResolvedValue({
      messages: { collected: 1, pending: 0, processing: 0, processed: 1, failed: 0 },
      ai: { runs: 1, failures: 0, inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 },
      tasks: { created: 1, eventsCreated: 2 },
      reports: { sent: 1, failed: 0 },
      jobs: { batches: 1, failedBatches: 0, averageDurationMs: 25 },
    });
    const controller = new InternalMetricsController(
      { snapshot } as never,
      { nodeEnv: 'development', internalAdminToken: '' } as never,
    );

    await expect(controller.snapshot(undefined)).resolves.toMatchObject({
      messages: { collected: 1, processed: 1 },
      reports: { sent: 1 },
    });
    expect(snapshot).toHaveBeenCalledOnce();
  });

  it('requires the internal admin token in production', async () => {
    const controller = new InternalMetricsController(
      { snapshot: vi.fn() } as never,
      { nodeEnv: 'production', internalAdminToken: 'secret' } as never,
    );

    await expect(controller.snapshot('wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
