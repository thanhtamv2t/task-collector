import { describe, expect, it } from 'vitest';
import { Task } from '../src/database/schema';
import { TaskMatcherService } from '../src/modules/tasks/task-matcher.service';

describe('TaskMatcherService', () => {
  const matcher = new TaskMatcherService();

  it('matches candidates by normalized title overlap', () => {
    const task = candidate({
      id: 'task-1',
      title: 'Finish webhook integration test',
      normalizedTitle: 'finish webhook integration test',
    });

    expect(
      matcher.match(
        {
          type: 'task_progress',
          title: 'Webhook integration test',
          summary: 'Progress was made.',
          confidence: 0.9,
          sourceMessageIds: [10],
        },
        [task],
      )?.id,
    ).toBe('task-1');
  });
});

function candidate(input: Pick<Task, 'id' | 'title' | 'normalizedTitle'>): Task {
  const now = new Date();
  return {
    id: input.id,
    groupId: 'group-1',
    topicId: 'topic-1',
    title: input.title,
    normalizedTitle: input.normalizedTitle,
    description: null,
    assigneeUserId: null,
    status: 'open',
    priority: null,
    dueDate: null,
    aiConfidence: null,
    firstSeenAt: now,
    lastUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
