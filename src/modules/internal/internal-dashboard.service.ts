import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  aiRuns,
  jobBatches,
  messages,
  reports,
  taskEvents,
  tasks,
  telegramGroups,
  telegramTopics,
  telegramUsers,
} from '../../database/schema';

@Injectable()
export class InternalDashboardService {
  constructor(private readonly database: DatabaseService) {}

  async groups() {
    return this.database.db
      .select({
        id: telegramGroups.id,
        title: telegramGroups.title,
        telegramChatId: telegramGroups.telegramChatId,
        isActive: telegramGroups.isActive,
        timezone: telegramGroups.timezone,
        reportChatId: telegramGroups.reportChatId,
        createdAt: telegramGroups.createdAt,
        updatedAt: telegramGroups.updatedAt,
        topicCount: sql<number>`count(distinct ${telegramTopics.id})::int`,
        monitoredTopicCount: sql<number>`
          count(distinct ${telegramTopics.id}) filter (where ${telegramTopics.isMonitored} = true)::int
        `,
        messageCount: sql<number>`count(distinct ${messages.id})::int`,
        taskCount: sql<number>`count(distinct ${tasks.id})::int`,
      })
      .from(telegramGroups)
      .leftJoin(telegramTopics, eq(telegramTopics.groupId, telegramGroups.id))
      .leftJoin(messages, eq(messages.groupId, telegramGroups.id))
      .leftJoin(tasks, eq(tasks.groupId, telegramGroups.id))
      .groupBy(telegramGroups.id)
      .orderBy(desc(telegramGroups.updatedAt));
  }

  async topics() {
    return this.database.db
      .select({
        id: telegramTopics.id,
        groupId: telegramTopics.groupId,
        groupTitle: telegramGroups.title,
        telegramThreadId: telegramTopics.telegramThreadId,
        name: telegramTopics.name,
        isMonitored: telegramTopics.isMonitored,
        reportThreadId: telegramTopics.reportThreadId,
        updatedAt: telegramTopics.updatedAt,
        messageCount: sql<number>`count(distinct ${messages.id})::int`,
        taskCount: sql<number>`count(distinct ${tasks.id})::int`,
      })
      .from(telegramTopics)
      .leftJoin(telegramGroups, eq(telegramGroups.id, telegramTopics.groupId))
      .leftJoin(messages, eq(messages.topicId, telegramTopics.id))
      .leftJoin(tasks, eq(tasks.topicId, telegramTopics.id))
      .groupBy(telegramTopics.id, telegramGroups.title)
      .orderBy(desc(telegramTopics.updatedAt));
  }

  async tasks(limit = 100) {
    return this.database.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        aiConfidence: tasks.aiConfidence,
        groupTitle: telegramGroups.title,
        topicName: telegramTopics.name,
        assignee: telegramUsers.displayName,
        assigneeUsername: telegramUsers.username,
        firstSeenAt: tasks.firstSeenAt,
        lastUpdatedAt: tasks.lastUpdatedAt,
        eventCount: sql<number>`count(distinct ${taskEvents.id})::int`,
      })
      .from(tasks)
      .leftJoin(telegramGroups, eq(telegramGroups.id, tasks.groupId))
      .leftJoin(telegramTopics, eq(telegramTopics.id, tasks.topicId))
      .leftJoin(telegramUsers, eq(telegramUsers.id, tasks.assigneeUserId))
      .leftJoin(taskEvents, eq(taskEvents.taskId, tasks.id))
      .groupBy(tasks.id, telegramGroups.title, telegramTopics.name, telegramUsers.displayName, telegramUsers.username)
      .orderBy(desc(tasks.lastUpdatedAt))
      .limit(limit);
  }

  async reports(limit = 50) {
    return this.database.db
      .select({
        id: reports.id,
        reportType: reports.reportType,
        status: reports.status,
        groupTitle: telegramGroups.title,
        periodStart: reports.periodStart,
        periodEnd: reports.periodEnd,
        telegramChatId: reports.telegramChatId,
        telegramThreadId: reports.telegramThreadId,
        telegramMessageId: reports.telegramMessageId,
        sentAt: reports.sentAt,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .leftJoin(telegramGroups, eq(telegramGroups.id, reports.groupId))
      .orderBy(desc(reports.createdAt))
      .limit(limit);
  }

  async messages(limit = 100) {
    return this.database.db
      .select({
        id: messages.id,
        telegramMessageId: messages.telegramMessageId,
        messageType: messages.messageType,
        text: messages.text,
        processingStatus: messages.processingStatus,
        groupTitle: telegramGroups.title,
        topicName: telegramTopics.name,
        sender: telegramUsers.displayName,
        senderUsername: telegramUsers.username,
        sentAt: messages.sentAt,
        editedAt: messages.editedAt,
      })
      .from(messages)
      .leftJoin(telegramGroups, eq(telegramGroups.id, messages.groupId))
      .leftJoin(telegramTopics, eq(telegramTopics.id, messages.topicId))
      .leftJoin(telegramUsers, eq(telegramUsers.id, messages.userId))
      .orderBy(desc(messages.sentAt))
      .limit(limit);
  }

  async jobs(limit = 100) {
    return this.database.db
      .select({
        id: jobBatches.id,
        batchKey: jobBatches.batchKey,
        jobType: jobBatches.jobType,
        status: jobBatches.status,
        periodStart: jobBatches.periodStart,
        periodEnd: jobBatches.periodEnd,
        errorMessage: jobBatches.errorMessage,
        createdAt: jobBatches.createdAt,
        updatedAt: jobBatches.updatedAt,
        completedAt: jobBatches.completedAt,
      })
      .from(jobBatches)
      .orderBy(desc(jobBatches.createdAt))
      .limit(limit);
  }

  async aiRuns(limit = 50) {
    return this.database.db
      .select({
        id: aiRuns.id,
        runType: aiRuns.runType,
        model: aiRuns.model,
        status: aiRuns.status,
        groupTitle: telegramGroups.title,
        topicName: telegramTopics.name,
        inputTokens: aiRuns.inputTokens,
        outputTokens: aiRuns.outputTokens,
        estimatedCost: aiRuns.estimatedCost,
        errorMessage: aiRuns.errorMessage,
        startedAt: aiRuns.startedAt,
        completedAt: aiRuns.completedAt,
      })
      .from(aiRuns)
      .leftJoin(telegramGroups, eq(telegramGroups.id, aiRuns.groupId))
      .leftJoin(telegramTopics, eq(telegramTopics.id, aiRuns.topicId))
      .orderBy(desc(aiRuns.startedAt))
      .limit(limit);
  }
}
