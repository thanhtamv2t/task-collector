import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, notInArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { taskEvents, tasks, telegramUsers } from '../../database/schema';

@Injectable()
export class TasksRepository {
  constructor(private readonly database: DatabaseService) {}

  async findUserByTelegramId(telegramUserId: string | null | undefined): Promise<string | null> {
    if (!telegramUserId) {
      return null;
    }

    const [user] = await this.database.db
      .select({ id: telegramUsers.id })
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramUserId, telegramUserId))
      .limit(1);

    return user?.id ?? null;
  }

  async findUserByUsername(username: string): Promise<string | null> {
    const [user] = await this.database.db
      .select({ id: telegramUsers.id })
      .from(telegramUsers)
      .where(eq(telegramUsers.username, username.replace(/^@/, '')))
      .limit(1);

    return user?.id ?? null;
  }

  async findTaskById(taskId: string) {
    const [task] = await this.database.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return task ?? null;
  }

  async findOpenCandidates(input: { groupId: string; topicId: string | null }) {
    return this.database.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.groupId, input.groupId),
          input.topicId === null ? isNull(tasks.topicId) : eq(tasks.topicId, input.topicId),
          notInArray(tasks.status, ['done', 'cancelled']),
        ),
      )
      .orderBy(desc(tasks.lastUpdatedAt))
      .limit(10);
  }

  async listOpenTasks(input: { groupId: string; topicId: string | null; limit?: number }) {
    return this.database.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.groupId, input.groupId),
          input.topicId === null ? isNull(tasks.topicId) : eq(tasks.topicId, input.topicId),
          notInArray(tasks.status, ['done', 'cancelled']),
        ),
      )
      .orderBy(desc(tasks.lastUpdatedAt))
      .limit(input.limit ?? 20);
  }

  async createTask(input: {
    groupId: string;
    topicId: string | null;
    title: string;
    normalizedTitle: string;
    description: string | null;
    assigneeUserId: string | null;
    priority: string | null;
    dueDate: Date | null;
    aiConfidence: number;
    occurredAt: Date;
  }): Promise<string> {
    const [task] = await this.database.db
      .insert(tasks)
      .values({
        groupId: input.groupId,
        topicId: input.topicId,
        title: input.title,
        normalizedTitle: input.normalizedTitle,
        description: input.description,
        assigneeUserId: input.assigneeUserId,
        status: 'open',
        priority: input.priority,
        dueDate: input.dueDate,
        aiConfidence: String(input.aiConfidence),
        firstSeenAt: input.occurredAt,
        lastUpdatedAt: input.occurredAt,
      })
      .returning({ id: tasks.id });

    if (!task) {
      throw new Error('Failed to create task');
    }

    return task.id;
  }

  async updateTask(input: {
    taskId: string;
    status?: string;
    description?: string;
    priority?: string | null;
    dueDate?: Date | null;
    aiConfidence: number;
    occurredAt: Date;
  }): Promise<void> {
    await this.database.db
      .update(tasks)
      .set({
        status: input.status,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        aiConfidence: String(input.aiConfidence),
        lastUpdatedAt: input.occurredAt,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, input.taskId));
  }

  async markTaskDone(input: { taskId: string; occurredAt: Date }): Promise<void> {
    await this.database.db
      .update(tasks)
      .set({
        status: 'done',
        lastUpdatedAt: input.occurredAt,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, input.taskId));
  }

  async assignTask(input: {
    taskId: string;
    assigneeUserId: string;
    occurredAt: Date;
  }): Promise<void> {
    await this.database.db
      .update(tasks)
      .set({
        assigneeUserId: input.assigneeUserId,
        lastUpdatedAt: input.occurredAt,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, input.taskId));
  }

  async createEvent(input: {
    taskId: string | null;
    groupId: string;
    topicId: string | null;
    eventType: string;
    summary: string;
    actorUserId: string | null;
    sourceMessageIds: number[];
    eventHash: string;
    aiConfidence: number;
    occurredAt: Date;
  }): Promise<boolean> {
    const inserted = await this.database.db
      .insert(taskEvents)
      .values({
        taskId: input.taskId,
        groupId: input.groupId,
        topicId: input.topicId,
        eventType: input.eventType,
        summary: input.summary,
        actorUserId: input.actorUserId,
        sourceMessageIds: input.sourceMessageIds,
        eventHash: input.eventHash,
        aiConfidence: String(input.aiConfidence),
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing({ target: taskEvents.eventHash })
      .returning({ id: taskEvents.id });

    return inserted.length > 0;
  }
}
