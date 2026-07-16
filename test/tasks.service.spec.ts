import { describe, expect, it } from 'vitest';
import { ExtractedEvent } from '../src/modules/ai/schemas/extracted-event.schema';
import { TaskMatcherService } from '../src/modules/tasks/task-matcher.service';
import { TasksRepository } from '../src/modules/tasks/tasks.repository';
import { TasksService } from '../src/modules/tasks/tasks.service';

interface CreatedEvent {
  taskId: string | null;
  eventType: string;
  summary: string;
  sourceMessageIds: number[];
  aiConfidence: number;
}

class FakeTasksRepository {
  readonly createdEvents: CreatedEvent[] = [];
  readonly createdTasks: string[] = [];
  markedDoneTaskId: string | null = null;
  assignedTask: { taskId: string; assigneeUserId: string } | null = null;

  async findUserByTelegramId(): Promise<string | null> {
    return 'actor-1';
  }

  async findUserByUsername(username: string): Promise<string | null> {
    return username.replace(/^@/, '') === 'alice' ? 'user-1' : null;
  }

  async findTaskById(taskId: string): Promise<{ id: string } | null> {
    return taskId === 'missing-task' ? null : { id: taskId };
  }

  async findOpenCandidates(): Promise<[]> {
    return [];
  }

  async createTask(input: { title: string }): Promise<string> {
    this.createdTasks.push(input.title);
    return 'task-1';
  }

  async updateTask(): Promise<void> {
    return undefined;
  }

  async markTaskDone(input: { taskId: string }): Promise<void> {
    this.markedDoneTaskId = input.taskId;
  }

  async assignTask(input: { taskId: string; assigneeUserId: string }): Promise<void> {
    this.assignedTask = {
      taskId: input.taskId,
      assigneeUserId: input.assigneeUserId,
    };
  }

  async createEvent(input: CreatedEvent): Promise<boolean> {
    this.createdEvents.push(input);
    return true;
  }
}

describe('TasksService', () => {
  it('applies high-confidence task events and preserves source/confidence', async () => {
    const repository = new FakeTasksRepository();
    const service = new TasksService(
      repository as unknown as TasksRepository,
      new TaskMatcherService(),
    );

    const result = await service.applyExtractedEvents({
      groupId: 'group-1',
      topicId: 'topic-1',
      occurredAt: new Date('2026-07-15T00:00:00.000Z'),
      events: [
        event({
          type: 'task_created',
          title: 'Finish collector',
          confidence: 0.91,
          sourceMessageIds: [1002],
        }),
      ],
    });

    expect(result).toEqual({ applied: 1, needsReview: 0, ignored: 0 });
    expect(repository.createdTasks).toEqual(['Finish collector']);
    expect(repository.createdEvents[0]).toMatchObject({
      taskId: 'task-1',
      eventType: 'task_created',
      sourceMessageIds: [1002],
      aiConfidence: 0.91,
    });
  });

  it('records medium-confidence events for review without creating tasks', async () => {
    const repository = new FakeTasksRepository();
    const service = new TasksService(
      repository as unknown as TasksRepository,
      new TaskMatcherService(),
    );

    const result = await service.applyExtractedEvents({
      groupId: 'group-1',
      topicId: 'topic-1',
      occurredAt: new Date('2026-07-15T00:00:00.000Z'),
      events: [
        event({
          type: 'follow_up',
          confidence: 0.6,
          sourceMessageIds: [1003],
        }),
      ],
    });

    expect(result).toEqual({ applied: 0, needsReview: 1, ignored: 0 });
    expect(repository.createdTasks).toEqual([]);
    expect(repository.createdEvents[0]).toMatchObject({
      taskId: null,
      eventType: 'follow_up',
      sourceMessageIds: [1003],
      aiConfidence: 0.6,
    });
  });

  it('ignores low-confidence events', async () => {
    const repository = new FakeTasksRepository();
    const service = new TasksService(
      repository as unknown as TasksRepository,
      new TaskMatcherService(),
    );

    const result = await service.applyExtractedEvents({
      groupId: 'group-1',
      topicId: 'topic-1',
      occurredAt: new Date('2026-07-15T00:00:00.000Z'),
      events: [
        event({
          type: 'task_created',
          title: 'Maybe do something',
          confidence: 0.2,
          sourceMessageIds: [1004],
        }),
      ],
    });

    expect(result).toEqual({ applied: 0, needsReview: 0, ignored: 1 });
    expect(repository.createdEvents).toEqual([]);
  });

  it('marks tasks done manually with audit source', async () => {
    const repository = new FakeTasksRepository();
    const service = new TasksService(
      repository as unknown as TasksRepository,
      new TaskMatcherService(),
    );

    const marked = await service.markDone({
      taskId: 'task-1',
      groupId: 'group-1',
      topicId: 'topic-1',
      actorTelegramUserId: '42',
      sourceMessageId: 2001,
    });

    expect(marked).toBe(true);
    expect(repository.markedDoneTaskId).toBe('task-1');
    expect(repository.createdEvents[0]).toMatchObject({
      taskId: 'task-1',
      eventType: 'task_completed',
      actorUserId: 'actor-1',
      sourceMessageIds: [2001],
      aiConfidence: 1,
    });
  });

  it('assigns tasks manually when the Telegram username is known', async () => {
    const repository = new FakeTasksRepository();
    const service = new TasksService(
      repository as unknown as TasksRepository,
      new TaskMatcherService(),
    );

    const result = await service.assign({
      taskId: 'task-1',
      username: '@alice',
      groupId: 'group-1',
      topicId: 'topic-1',
      actorTelegramUserId: '42',
      sourceMessageId: 2002,
    });

    expect(result).toBe('assigned');
    expect(repository.assignedTask).toEqual({ taskId: 'task-1', assigneeUserId: 'user-1' });
    expect(repository.createdEvents[0]).toMatchObject({
      taskId: 'task-1',
      eventType: 'task_assigned',
      sourceMessageIds: [2002],
      aiConfidence: 1,
    });
  });
});

function event(input: {
  type: ExtractedEvent['type'];
  title?: string;
  confidence: number;
  sourceMessageIds: number[];
}): ExtractedEvent {
  return {
    type: input.type,
    title: input.title,
    summary: input.title ?? 'Follow up with the team.',
    confidence: input.confidence,
    sourceMessageIds: input.sourceMessageIds,
  };
}
