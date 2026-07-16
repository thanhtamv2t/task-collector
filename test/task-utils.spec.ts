import { describe, expect, it } from 'vitest';
import { buildTaskEventHash, normalizeTaskTitle } from '../src/modules/tasks/task-utils';

describe('task utils', () => {
  it('normalizes task titles for matching', () => {
    expect(normalizeTaskTitle('  Hoàn thành API / Webhook!!! ')).toBe('hoan thanh api webhook');
  });

  it('builds stable task event hashes regardless of source message order', () => {
    const left = buildTaskEventHash({
      taskId: 'task-1',
      groupId: 'group-1',
      topicId: 'topic-1',
      eventType: 'task_progress',
      sourceMessageIds: [3, 1, 2],
    });
    const right = buildTaskEventHash({
      taskId: 'task-1',
      groupId: 'group-1',
      topicId: 'topic-1',
      eventType: 'task_progress',
      sourceMessageIds: [1, 2, 3],
    });

    expect(left).toBe(right);
  });
});
