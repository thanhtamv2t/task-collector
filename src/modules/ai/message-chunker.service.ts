import { Injectable } from '@nestjs/common';
import { ExtractionPromptMessage } from './task-extractor.service';

const DEFAULT_MAX_CHUNK_CHARS = 12000;

@Injectable()
export class MessageChunkerService {
  chunk(messages: ExtractionPromptMessage[], maxChunkChars = DEFAULT_MAX_CHUNK_CHARS): ExtractionPromptMessage[][] {
    const chunks: ExtractionPromptMessage[][] = [];
    let current: ExtractionPromptMessage[] = [];
    let currentSize = 0;

    for (const message of messages) {
      const messageSize = this.estimateSize(message);

      if (current.length > 0 && currentSize + messageSize > maxChunkChars) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }

      current.push(message);
      currentSize += messageSize;
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    return chunks;
  }

  private estimateSize(message: ExtractionPromptMessage): number {
    return [
      message.telegramMessageId,
      message.sentAt,
      message.telegramUserId,
      message.displayName,
      message.text,
    ].join('').length;
  }
}
