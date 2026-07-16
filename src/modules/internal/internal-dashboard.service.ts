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
      })
      .from(telegramGroups)
      .leftJoin(telegramTopics, eq(telegramTopics.groupId, telegramGroups.id))
      .leftJoin(messages, eq(messages.groupId, telegramGroups.id))
      .groupBy(telegramGroups.id)
      .orderBy(desc(telegramGroups.updatedAt));
  }

  async groupById(groupId: string) {
    const [group] = await this.database.db
      .select({
        id: telegramGroups.id,
        title: telegramGroups.title,
        reportChatId: telegramGroups.reportChatId,
      })
      .from(telegramGroups)
      .where(eq(telegramGroups.id, groupId))
      .limit(1);

    return group ?? null;
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
      })
      .from(telegramTopics)
      .leftJoin(telegramGroups, eq(telegramGroups.id, telegramTopics.groupId))
      .leftJoin(messages, eq(messages.topicId, telegramTopics.id))
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
        content: reports.content,
        structuredContent: reports.structuredContent,
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

  async cleanDerivedData() {
    const deletedReports = await this.database.db.delete(reports).returning({ id: reports.id });
    const deletedAiRuns = await this.database.db.delete(aiRuns).returning({ id: aiRuns.id });
    const deletedJobBatches = await this.database.db.delete(jobBatches).returning({ id: jobBatches.id });
    const deletedTaskEvents = await this.database.db.delete(taskEvents).returning({ id: taskEvents.id });
    const deletedTasks = await this.database.db.delete(tasks).returning({ id: tasks.id });

    return {
      deletedReports: deletedReports.length,
      deletedAiRuns: deletedAiRuns.length,
      deletedJobBatches: deletedJobBatches.length,
      deletedTaskEvents: deletedTaskEvents.length,
      deletedTasks: deletedTasks.length,
      preservedMessages: true,
    };
  }

  async performance(input: {
    mode: string;
    page: number;
    pageSize: number;
    memberName?: string;
    from?: string;
    to?: string;
  }) {
    const mode = ['day', 'week', 'month', 'year'].includes(input.mode) ? input.mode : 'week';
    const page = Math.max(1, input.page);
    const pageSize = Math.min(50, Math.max(5, input.pageSize));
    const offset = (page - 1) * pageSize;
    const periodUnit = mode === 'day' ? 'day' : mode === 'month' ? 'month' : mode === 'year' ? 'year' : 'week';
    const memberFilter = input.memberName ? sql`and coalesce(user_group.value->>'name', 'Unknown') = ${input.memberName}` : sql``;
    const dateFilter = input.from ? sql`and r.period_start >= ${new Date(input.from)}` : sql``;
    const endFilter = input.to ? sql`and r.period_start <= ${new Date(input.to)}` : sql``;

    const rowsResult = await this.database.db.execute(sql`
      with report_items as (
        select
          date_trunc('${periodUnit}', r.period_start) as period_start,
          date_trunc('${periodUnit}', r.period_start) + interval '1 ${periodUnit}' as period_end,
          coalesce(user_group.value->>'name', 'Unknown') as member_name,
          item.value->>'eventType' as event_type,
          item.value->>'summary' as summary,
          item.value->'sourceMessageIds' as source_message_ids,
          coalesce(item.value->>'createdAt', r.created_at::text) as occurred_at
        from reports r
        cross join lateral jsonb_array_elements(r.structured_content->'byUser') as user_group(value)
        cross join lateral jsonb_array_elements(user_group.value->'items') as item(value)
        where 1 = 1
          ${memberFilter} ${dateFilter} ${endFilter}
      ),
      grouped as (
        select
          period_start,
          period_end,
          member_name,
          count(*)::int as total_items,
          count(*) filter (where event_type = 'task_completed')::int as completed_items,
          count(*) filter (where event_type = 'task_progress')::int as progress_items,
          count(*) filter (where event_type = 'blocker')::int as blocker_items,
          count(*) filter (where event_type = 'decision')::int as decision_items,
          max(occurred_at) as last_activity_at,
          jsonb_agg(
            jsonb_build_object(
              'summary', summary,
              'eventType', event_type,
              'sourceMessageIds', source_message_ids,
              'occurredAt', occurred_at
            )
            order by occurred_at desc
          ) as items
        from report_items
        where event_type in ('task_completed', 'task_progress', 'blocker', 'decision')
        group by period_start, period_end, member_name
      )
      select *
      from grouped
      order by period_start desc, member_name asc
      limit ${pageSize}
      offset ${offset}
    `);
    const countResult = await this.database.db.execute(sql`
      select count(*)::int as total
      from (
        select
          date_trunc('${periodUnit}', r.period_start),
          coalesce(user_group.value->>'name', 'Unknown') as member_name
        from reports r
        cross join lateral jsonb_array_elements(r.structured_content->'byUser') as user_group(value)
        cross join lateral jsonb_array_elements(user_group.value->'items') as item(value)
        where item.value->>'eventType' in ('task_completed', 'task_progress', 'blocker', 'decision')
          ${memberFilter} ${dateFilter} ${endFilter}
        group by 1, 2
      ) rows
    `);
    const membersResult = await this.database.db.execute(sql`
      select distinct coalesce(user_group.value->>'name', 'Unknown') as member_name
      from reports r
      cross join lateral jsonb_array_elements(r.structured_content->'byUser') as user_group(value)
      order by member_name asc
    `);

    const rows = (rowsResult as unknown as { rows: Array<Record<string, unknown>> }).rows;
    const total = Number((countResult as unknown as { rows: Array<{ total: number }> }).rows[0]?.total ?? 0);

    return {
      mode,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      members: ((membersResult as unknown as { rows: Array<{ member_name: string }> }).rows ?? []).map(
        (row) => row.member_name,
      ),
      rows: rows.map((row) => ({
        periodStart: row.period_start,
        periodEnd: row.period_end,
        memberName: row.member_name,
        username: null,
        telegramUserId: null,
        totalItems: row.total_items,
        completedItems: row.completed_items,
        progressItems: row.progress_items,
        blockerItems: row.blocker_items,
        decisionItems: row.decision_items,
        lastActivityAt: row.last_activity_at,
        items: Array.isArray(row.items) ? row.items.slice(0, 8) : [],
      })),
    };
  }
}
