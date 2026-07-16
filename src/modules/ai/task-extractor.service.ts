import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { aiConfig } from '../../config/ai.config';
import { EXTRACTION_PROMPT_VERSION, buildExtractionPrompt } from './prompts/extraction.prompt';
import { extractionOutputSchema, ExtractionOutput } from './schemas/extracted-event.schema';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter.client';

export interface ExtractionPromptMessage {
  groupId: string;
  topicId: string | null;
  telegramMessageId: number;
  text: string;
  sentAt: string;
  groupTitle: string | null;
  topicName: string | null;
  displayName: string | null;
  telegramUserId: string | null;
}

export interface TaskExtractionResult {
  aiRunId: string | null;
  output: ExtractionOutput;
  skipped: boolean;
  reason?: string;
}

@Injectable()
export class TaskExtractorService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly openRouter: OpenRouterClient,
    @Inject(aiConfig.KEY)
    private readonly config: ConfigType<typeof aiConfig>,
  ) {}

  async extract(input: {
    groupId: string;
    topicId: string | null;
    periodStart: string;
    periodEnd: string;
    messages: ExtractionPromptMessage[];
  }): Promise<TaskExtractionResult> {
    if (input.messages.length === 0) {
      return {
        aiRunId: null,
        output: { events: [] },
        skipped: true,
        reason: 'no_messages',
      };
    }

    if (!this.openRouter.isConfigured()) {
      return {
        aiRunId: null,
        output: { events: [] },
        skipped: true,
        reason: 'openrouter_not_configured',
      };
    }

    await this.assertCostGuardrail();

    const prompt = buildExtractionPrompt({
      groupTitle: input.messages[0]?.groupTitle ?? 'unknown',
      topicName: input.messages[0]?.topicName ?? 'unknown',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      messages: input.messages,
    });

    const inputMessageIds = input.messages.map((message) => message.telegramMessageId);
    const aiRunId = await this.aiRepository.createRun({
      groupId: input.groupId,
      topicId: input.topicId,
      runType: 'extraction',
      model: this.openRouter.primaryModel(),
      inputMessageIds,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });

    let lastRawResponse: unknown;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await this.openRouter.extractJson(
          attempt === 1
            ? prompt
            : `${prompt}\n\nPrevious response failed validation. Return corrected JSON only. Error: ${lastError?.message ?? 'unknown validation error'}`,
        );
        lastRawResponse = response.rawResponse;
        const parsedJson = JSON.parse(response.content) as unknown;
        const output = extractionOutputSchema.parse(parsedJson);
        await this.aiRepository.completeRun(aiRunId, {
          rawResponse: response.rawResponse,
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
          estimatedCost: this.estimateCost(
            response.usage?.prompt_tokens ?? null,
            response.usage?.completion_tokens ?? null,
          ),
        });

        return {
          aiRunId,
          output,
          skipped: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('AI extraction failed');
      }
    }

    const normalizedError = lastError ?? new Error('AI extraction failed');
    await this.aiRepository.failRun(aiRunId, normalizedError, lastRawResponse);
    throw normalizedError;
  }

  private estimateCost(inputTokens: number | null, outputTokens: number | null): number | null {
    if (
      inputTokens === null ||
      outputTokens === null ||
      this.config.inputCostPer1MTokens === null ||
      this.config.outputCostPer1MTokens === null
    ) {
      return null;
    }

    return (
      (inputTokens / 1_000_000) * this.config.inputCostPer1MTokens +
      (outputTokens / 1_000_000) * this.config.outputCostPer1MTokens
    );
  }

  private async assertCostGuardrail(): Promise<void> {
    if (this.config.dailyCostLimitUsd === null) {
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const spent = await this.aiRepository.sumEstimatedCostSince(today);

    if (spent >= this.config.dailyCostLimitUsd) {
      throw new Error('AI daily cost guardrail exceeded');
    }
  }
}
