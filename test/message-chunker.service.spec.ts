import { describe, expect, it } from 'vitest';
import { MessageChunkerService } from '../src/modules/ai/message-chunker.service';
import { ExtractionPromptMessage } from '../src/modules/ai/task-extractor.service';

describe('MessageChunkerService', () => {
  const service = new MessageChunkerService();

  it('keeps chronological messages in bounded chunks', () => {
    const messages: ExtractionPromptMessage[] = [
      message(1, 'short'),
      message(2, 'x'.repeat(20)),
      message(3, 'x'.repeat(20)),
    ];

    const chunks = service.chunk(messages, 40);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat().map((item) => item.telegramMessageId)).toEqual([1, 2, 3]);
  });
});

function message(id: number, text: string): ExtractionPromptMessage {
  return {
    groupId: 'group-1',
    topicId: 'topic-1',
    telegramMessageId: id,
    text,
    sentAt: '2026-07-15T00:00:00.000Z',
    groupTitle: 'Engineering',
    topicName: 'Backend',
    displayName: 'Alice',
    telegramUserId: '77',
  };
}
