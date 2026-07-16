import { Injectable, Logger } from '@nestjs/common';
import { MessageChunkerService } from '../ai/message-chunker.service';
import { TaskExtractorService, ExtractionPromptMessage } from '../ai/task-extractor.service';
import { TasksService } from '../tasks/tasks.service';
import { DEFAULT_JOB_BATCH_SIZE, JOB_QUEUE_NAMES } from './jobs.constants';
import { JobPayloadService } from './job-payload.service';
import { JobsRepository } from './jobs.repository';
import { ExtractionJobResult, JobPayload } from './jobs.types';

@Injectable()
export class ExtractionJob {
  private readonly logger = new Logger(ExtractionJob.name);

  constructor(
    private readonly repository: JobsRepository,
    private readonly payloads: JobPayloadService,
    private readonly taskExtractor: TaskExtractorService,
    private readonly chunker: MessageChunkerService,
    private readonly tasksService: TasksService,
  ) {}

  async handle(payload: JobPayload): Promise<ExtractionJobResult> {
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);
    const batchKey = this.payloads.batchKey(JOB_QUEUE_NAMES.extraction, payload);
    const batch = await this.repository.ensureBatch({
      jobType: JOB_QUEUE_NAMES.extraction,
      batchKey,
      groupId: payload.groupId,
      topicId: payload.topicId,
      periodStart,
      periodEnd,
    });

    if (!batch.created) {
      this.logger.log(`Skipped duplicate extraction batch ${batchKey}`);
      return {
        batchId: batch.id,
        batchKey,
        lockedMessageCount: 0,
        skipped: true,
      };
    }

    let lockedMessageIds: string[] = [];

    try {
      await this.repository.markBatchRunning(batch.id);
      lockedMessageIds = await this.repository.lockPendingMessages({
        batchId: batch.id,
        groupId: payload.groupId,
        topicId: payload.topicId,
        periodStart,
        periodEnd,
        limit: DEFAULT_JOB_BATCH_SIZE,
      });
      const messages = await this.repository.getMessagesByIds(lockedMessageIds);
      const groups = this.groupMessagesForExtraction(messages);
      let aiSkipped = false;

      for (const group of groups) {
        for (const chunk of this.chunker.chunk(group.messages)) {
          const result = await this.taskExtractor.extract({
            groupId: group.groupId,
            topicId: group.topicId,
            periodStart: payload.periodStart,
            periodEnd: payload.periodEnd,
            messages: chunk,
          });
          aiSkipped = aiSkipped || result.skipped;
          if (!result.skipped) {
            await this.tasksService.applyExtractedEvents({
              groupId: group.groupId,
              topicId: group.topicId,
              events: result.output.events,
              occurredAt: periodEnd,
            });
          }
        }
      }

      if (aiSkipped) {
        await this.repository.releaseMessages(lockedMessageIds);
      } else {
        await this.repository.markMessagesProcessed(lockedMessageIds);
      }

      await this.repository.markBatchCompleted(batch.id, lockedMessageIds);

      return {
        batchId: batch.id,
        batchKey,
        lockedMessageCount: lockedMessageIds.length,
        skipped: false,
      };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Unknown extraction error');
      await this.repository.releaseMessages(lockedMessageIds);
      await this.repository.markBatchFailed(batch.id, normalizedError);
      throw normalizedError;
    }
  }

  private groupMessagesForExtraction(
    messages: Array<{
      groupId: string;
      topicId: string | null;
      telegramMessageId: string;
      text: string | null;
      sentAt: Date;
      groupTitle: string | null;
      topicName: string | null;
      displayName: string | null;
      telegramUserId: string | null;
    }>,
  ): Array<{ groupId: string; topicId: string | null; messages: ExtractionPromptMessage[] }> {
    const grouped = new Map<string, { groupId: string; topicId: string | null; messages: ExtractionPromptMessage[] }>();

    for (const message of messages) {
      const key = `${message.groupId}:${message.topicId ?? 'general'}`;
      const existing =
        grouped.get(key) ??
        {
          groupId: message.groupId,
          topicId: message.topicId,
          messages: [],
        };

      existing.messages.push({
        groupId: message.groupId,
        topicId: message.topicId,
        telegramMessageId: Number(message.telegramMessageId),
        text: message.text ?? '',
        sentAt: message.sentAt.toISOString(),
        groupTitle: message.groupTitle,
        topicName: message.topicName,
        displayName: message.displayName,
        telegramUserId: message.telegramUserId,
      });
      grouped.set(key, existing);
    }

    return Array.from(grouped.values());
  }
}
