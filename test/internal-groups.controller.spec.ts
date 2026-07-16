import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InternalGroupsController } from '../src/modules/internal/internal.controller';

describe('InternalGroupsController', () => {
  const app = { nodeEnv: 'development', internalAdminToken: '' } as never;
  const groups = {
    deleteGroupData: vi.fn(),
  };

  it('triggers extraction scoped to the group id from the route', async () => {
    const triggerExtraction = vi.fn().mockResolvedValue({
      queue: 'task-reporter.extraction',
      jobId: 'job-1',
      payload: {},
    });
    const controller = new InternalGroupsController(
      { triggerExtraction } as never,
      groups as never,
      app,
    );

    const result = await controller.reprocessGroup(undefined, 'group-route-id', {
      groupId: 'body-group-id',
      topicId: 'topic-1',
      periodStart: '2026-07-15T01:00:00.000Z',
      periodEnd: '2026-07-15T02:00:00.000Z',
    });

    expect(result.jobId).toBe('job-1');
    expect(triggerExtraction).toHaveBeenCalledWith({
      groupId: 'group-route-id',
      topicId: 'topic-1',
      periodStart: '2026-07-15T01:00:00.000Z',
      periodEnd: '2026-07-15T02:00:00.000Z',
    });
  });

  it('requires the internal admin token in production', async () => {
    const controller = new InternalGroupsController(
      { triggerExtraction: vi.fn() } as never,
      groups as never,
      { nodeEnv: 'production', internalAdminToken: 'secret' } as never,
    );

    await expect(controller.reprocessGroup('wrong', 'group-1', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('converts trigger errors into bad requests', async () => {
    const controller = new InternalGroupsController(
      {
        triggerExtraction: vi.fn().mockRejectedValue(new Error('periodStart must be before periodEnd')),
      } as never,
      groups as never,
      app,
    );

    await expect(controller.reprocessGroup(undefined, 'group-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deletes group-scoped data through the internal groups service', async () => {
    const deleteGroupData = vi.fn().mockResolvedValue({
      groupId: 'group-1',
      deletedGroup: true,
      deletedJobBatches: 2,
    });
    const controller = new InternalGroupsController(
      { triggerExtraction: vi.fn() } as never,
      { deleteGroupData } as never,
      app,
    );

    await expect(controller.deleteGroupData(undefined, 'group-1')).resolves.toEqual({
      groupId: 'group-1',
      deletedGroup: true,
      deletedJobBatches: 2,
    });
    expect(deleteGroupData).toHaveBeenCalledWith('group-1');
  });

  it('returns not found when deleting an unknown group', async () => {
    const controller = new InternalGroupsController(
      { triggerExtraction: vi.fn() } as never,
      {
        deleteGroupData: vi.fn().mockResolvedValue({
          groupId: 'missing-group',
          deletedGroup: false,
          deletedJobBatches: 0,
        }),
      } as never,
      app,
    );

    await expect(controller.deleteGroupData(undefined, 'missing-group')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
