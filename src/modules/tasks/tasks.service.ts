import { Injectable } from '@nestjs/common';
import { ExtractedEvent } from '../ai/schemas/extracted-event.schema';
import { TaskMatcherService } from './task-matcher.service';
import { buildTaskEventHash, normalizeTaskTitle } from './task-utils';
import { TasksRepository } from './tasks.repository';

const AUTO_APPLY_CONFIDENCE = Number(process.env.AI_AUTO_APPLY_CONFIDENCE ?? 0.8);
const REVIEW_CONFIDENCE = Number(process.env.AI_REVIEW_CONFIDENCE ?? 0.5);

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly matcher: TaskMatcherService,
  ) {}

  async applyExtractedEvents(input: {
    groupId: string;
    topicId: string | null;
    events: ExtractedEvent[];
    occurredAt: Date;
  }): Promise<{ applied: number; needsReview: number; ignored: number }> {
    let applied = 0;
    let needsReview = 0;
    let ignored = 0;

    for (const event of input.events) {
      if (event.type === 'ignore' || event.confidence < REVIEW_CONFIDENCE) {
        ignored += 1;
        continue;
      }

      if (event.confidence < AUTO_APPLY_CONFIDENCE) {
        await this.recordEvent({
          groupId: input.groupId,
          topicId: input.topicId,
          taskId: null,
          event,
          occurredAt: input.occurredAt,
        });
        needsReview += 1;
        continue;
      }

      const candidates = await this.repository.findOpenCandidates({
        groupId: input.groupId,
        topicId: input.topicId,
      });
      const matchedTask = this.matcher.match(event, candidates);
      const taskId = await this.applyEventToTask({
        groupId: input.groupId,
        topicId: input.topicId,
        taskId: matchedTask?.id ?? null,
        event,
        occurredAt: input.occurredAt,
      });

      await this.recordEvent({
        groupId: input.groupId,
        topicId: input.topicId,
        taskId,
        event,
        occurredAt: input.occurredAt,
      });
      applied += 1;
    }

    return { applied, needsReview, ignored };
  }

  async listOpenTasks(input: { groupId: string; topicId: string | null }): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      priority: string | null;
      dueDate: Date | null;
    }>
  > {
    const tasks = await this.repository.listOpenTasks(input);
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    }));
  }

  async markDone(input: {
    taskId: string;
    groupId: string;
    topicId: string | null;
    actorTelegramUserId: string | null;
    sourceMessageId: number;
  }): Promise<boolean> {
    const task = await this.repository.findTaskById(input.taskId);
    if (!task) {
      return false;
    }

    const occurredAt = new Date();
    await this.repository.markTaskDone({ taskId: input.taskId, occurredAt });
    await this.repository.createEvent({
      taskId: input.taskId,
      groupId: input.groupId,
      topicId: input.topicId,
      eventType: 'task_completed',
      summary: 'Task was manually marked done from Telegram command.',
      actorUserId: await this.repository.findUserByTelegramId(input.actorTelegramUserId),
      sourceMessageIds: [input.sourceMessageId],
      eventHash: buildTaskEventHash({
        taskId: input.taskId,
        groupId: input.groupId,
        topicId: input.topicId,
        eventType: 'task_completed',
        sourceMessageIds: [input.sourceMessageId],
      }),
      aiConfidence: 1,
      occurredAt,
    });

    return true;
  }

  async assign(input: {
    taskId: string;
    username: string;
    groupId: string;
    topicId: string | null;
    actorTelegramUserId: string | null;
    sourceMessageId: number;
  }): Promise<'task_not_found' | 'user_not_found' | 'assigned'> {
    const task = await this.repository.findTaskById(input.taskId);
    if (!task) {
      return 'task_not_found';
    }

    const assigneeUserId = await this.repository.findUserByUsername(input.username);
    if (!assigneeUserId) {
      return 'user_not_found';
    }

    const occurredAt = new Date();
    await this.repository.assignTask({
      taskId: input.taskId,
      assigneeUserId,
      occurredAt,
    });
    await this.repository.createEvent({
      taskId: input.taskId,
      groupId: input.groupId,
      topicId: input.topicId,
      eventType: 'task_assigned',
      summary: `Task was manually assigned to ${input.username.replace(/^@/, '')}.`,
      actorUserId: await this.repository.findUserByTelegramId(input.actorTelegramUserId),
      sourceMessageIds: [input.sourceMessageId],
      eventHash: buildTaskEventHash({
        taskId: input.taskId,
        groupId: input.groupId,
        topicId: input.topicId,
        eventType: 'task_assigned',
        sourceMessageIds: [input.sourceMessageId],
      }),
      aiConfidence: 1,
      occurredAt,
    });

    return 'assigned';
  }

  private async applyEventToTask(input: {
    groupId: string;
    topicId: string | null;
    taskId: string | null;
    event: ExtractedEvent;
    occurredAt: Date;
  }): Promise<string | null> {
    if (input.event.type === 'decision' || input.event.type === 'follow_up') {
      return input.taskId;
    }

    const assigneeUserId = await this.repository.findUserByTelegramId(
      input.event.assigneeTelegramUserId,
    );
    const dueDate = input.event.dueDate ? new Date(input.event.dueDate) : null;

    if (input.event.type === 'task_created' && !input.taskId) {
      const title = input.event.title ?? input.event.summary;
      return this.repository.createTask({
        groupId: input.groupId,
        topicId: input.topicId,
        title,
        normalizedTitle: normalizeTaskTitle(title),
        description: input.event.summary,
        assigneeUserId,
        priority: input.event.priority ?? null,
        dueDate,
        aiConfidence: input.event.confidence,
        occurredAt: input.occurredAt,
      });
    }

    if (!input.taskId) {
      return null;
    }

    await this.repository.updateTask({
      taskId: input.taskId,
      status: this.statusForEvent(input.event.type),
      description: input.event.summary,
      priority: input.event.priority ?? undefined,
      dueDate: dueDate ?? undefined,
      aiConfidence: input.event.confidence,
      occurredAt: input.occurredAt,
    });

    return input.taskId;
  }

  private async recordEvent(input: {
    groupId: string;
    topicId: string | null;
    taskId: string | null;
    event: ExtractedEvent;
    occurredAt: Date;
  }): Promise<void> {
    await this.repository.createEvent({
      taskId: input.taskId,
      groupId: input.groupId,
      topicId: input.topicId,
      eventType: input.event.type,
      summary: input.event.summary,
      actorUserId: await this.repository.findUserByTelegramId(input.event.assigneeTelegramUserId),
      sourceMessageIds: input.event.sourceMessageIds,
      eventHash: buildTaskEventHash({
        taskId: input.taskId,
        groupId: input.groupId,
        topicId: input.topicId,
        eventType: input.event.type,
        sourceMessageIds: input.event.sourceMessageIds,
      }),
      aiConfidence: input.event.confidence,
      occurredAt: input.occurredAt,
    });
  }

  private statusForEvent(eventType: ExtractedEvent['type']): string | undefined {
    switch (eventType) {
      case 'task_progress':
        return 'in_progress';
      case 'task_completed':
        return 'done';
      case 'task_reopened':
        return 'open';
      case 'blocker':
        return 'blocked';
      default:
        return undefined;
    }
  }
}
