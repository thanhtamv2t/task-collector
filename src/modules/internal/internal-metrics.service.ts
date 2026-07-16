import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { aiRuns, jobBatches, messages, reports, taskEvents, tasks } from '../../database/schema';

export interface InternalMetricsSnapshot {
  messages: {
    collected: number;
    pending: number;
    processing: number;
    processed: number;
    failed: number;
  };
  ai: {
    runs: number;
    failures: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  tasks: {
    created: number;
    eventsCreated: number;
  };
  reports: {
    sent: number;
    failed: number;
  };
  jobs: {
    batches: number;
    failedBatches: number;
    averageDurationMs: number | null;
  };
}

@Injectable()
export class InternalMetricsService {
  constructor(private readonly database: DatabaseService) {}

  async snapshot(): Promise<InternalMetricsSnapshot> {
    const [
      messagesCollected,
      messagesPending,
      messagesProcessing,
      messagesProcessed,
      messagesFailed,
      aiRunsCount,
      aiFailures,
      aiInputTokens,
      aiOutputTokens,
      aiEstimatedCost,
      tasksCreated,
      taskEventsCreated,
      reportsSent,
      reportsFailed,
      jobBatchesCount,
      failedBatches,
      averageDurationMs,
    ] = await Promise.all([
      this.countRows(messages),
      this.countRows(messages, eq(messages.processingStatus, 'pending')),
      this.countRows(messages, eq(messages.processingStatus, 'processing')),
      this.countRows(messages, eq(messages.processingStatus, 'processed')),
      this.countRows(messages, eq(messages.processingStatus, 'failed')),
      this.countRows(aiRuns),
      this.countRows(aiRuns, eq(aiRuns.status, 'failed')),
      this.sumNumber(aiRuns.inputTokens),
      this.sumNumber(aiRuns.outputTokens),
      this.sumNumber(aiRuns.estimatedCost),
      this.countRows(tasks),
      this.countRows(taskEvents),
      this.countRows(reports, eq(reports.status, 'sent')),
      this.countRows(reports, eq(reports.status, 'failed')),
      this.countRows(jobBatches),
      this.countRows(jobBatches, eq(jobBatches.status, 'failed')),
      this.averageJobDurationMs(),
    ]);

    return {
      messages: {
        collected: messagesCollected,
        pending: messagesPending,
        processing: messagesProcessing,
        processed: messagesProcessed,
        failed: messagesFailed,
      },
      ai: {
        runs: aiRunsCount,
        failures: aiFailures,
        inputTokens: aiInputTokens,
        outputTokens: aiOutputTokens,
        estimatedCostUsd: aiEstimatedCost,
      },
      tasks: {
        created: tasksCreated,
        eventsCreated: taskEventsCreated,
      },
      reports: {
        sent: reportsSent,
        failed: reportsFailed,
      },
      jobs: {
        batches: jobBatchesCount,
        failedBatches,
        averageDurationMs,
      },
    };
  }

  private async countRows(
    table: typeof messages | typeof aiRuns | typeof tasks | typeof taskEvents | typeof reports | typeof jobBatches,
    where?: ReturnType<typeof eq>,
  ): Promise<number> {
    const query = this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(table)
      .$dynamic();

    if (where) {
      query.where(where);
    }

    const [row] = await query;
    return Number(row?.value ?? 0);
  }

  private async sumNumber(column: typeof aiRuns.inputTokens | typeof aiRuns.outputTokens | typeof aiRuns.estimatedCost) {
    const [row] = await this.database.db
      .select({ value: sql<string | null>`coalesce(sum(${column}), 0)::text` })
      .from(aiRuns);

    return Number(row?.value ?? 0);
  }

  private async averageJobDurationMs(): Promise<number | null> {
    const [row] = await this.database.db
      .select({
        value: sql<string | null>`
          avg(extract(epoch from (${jobBatches.completedAt} - ${jobBatches.createdAt})) * 1000)::text
        `,
      })
      .from(jobBatches)
      .where(eq(jobBatches.status, 'completed'));

    return row?.value === null || row?.value === undefined ? null : Math.round(Number(row.value));
  }
}
