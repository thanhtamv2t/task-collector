import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class RetentionJob {
  constructor(
    private readonly repository: JobsRepository,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async handle(): Promise<{
    clearedAiRawResponses: number;
    clearedMessageRawPayloads: number;
    deletedMessages: number;
  }> {
    const now = Date.now();
    const aiCutoff = new Date(
      now - this.app.aiRawResponseRetentionDays * 24 * 60 * 60 * 1000,
    );
    const rawPayloadCutoff = new Date(
      now - this.app.rawPayloadRetentionDays * 24 * 60 * 60 * 1000,
    );
    const messageCutoff = new Date(
      now - this.app.normalizedMessageRetentionDays * 24 * 60 * 60 * 1000,
    );

    const clearedAiRawResponses = await this.repository.clearOldAiRawResponses(aiCutoff);
    const clearedMessageRawPayloads =
      await this.repository.clearOldMessageRawPayloads(rawPayloadCutoff);
    const deletedMessages = await this.repository.deleteOldProcessedMessages(messageCutoff);

    return { clearedAiRawResponses, clearedMessageRawPayloads, deletedMessages };
  }
}
