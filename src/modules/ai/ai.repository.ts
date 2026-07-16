import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { aiRuns } from '../../database/schema';

@Injectable()
export class AiRepository {
  constructor(private readonly database: DatabaseService) {}

  async createRun(input: {
    groupId: string;
    topicId: string | null;
    runType: string;
    model: string;
    inputMessageIds: number[];
    promptVersion: string;
  }): Promise<string> {
    const [run] = await this.database.db
      .insert(aiRuns)
      .values({
        groupId: input.groupId,
        topicId: input.topicId,
        runType: input.runType,
        model: input.model,
        inputMessageIds: input.inputMessageIds,
        promptVersion: input.promptVersion,
        status: 'running',
        startedAt: new Date(),
      })
      .returning({ id: aiRuns.id });

    if (!run) {
      throw new Error('Failed to create AI run');
    }

    return run.id;
  }

  async completeRun(
    runId: string,
    input: {
      rawResponse: unknown;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCost: number | null;
    },
  ): Promise<void> {
    await this.database.db
      .update(aiRuns)
      .set({
        status: 'completed',
        rawResponse: input.rawResponse,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCost: input.estimatedCost === null ? null : String(input.estimatedCost),
        completedAt: new Date(),
      })
      .where(eq(aiRuns.id, runId));
  }

  async sumEstimatedCostSince(since: Date): Promise<number> {
    const rows = await this.database.db.select().from(aiRuns);
    return rows
      .filter((run) => run.createdAt >= since)
      .reduce((sum, run) => sum + Number(run.estimatedCost ?? 0), 0);
  }

  async failRun(runId: string, error: Error, rawResponse?: unknown): Promise<void> {
    await this.database.db
      .update(aiRuns)
      .set({
        status: 'failed',
        errorMessage: error.message,
        rawResponse,
        completedAt: new Date(),
      })
      .where(eq(aiRuns.id, runId));
  }
}
