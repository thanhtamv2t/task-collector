import { describe, expect, it } from 'vitest';
import { buildExtractionPrompt } from '../src/modules/ai/prompts/extraction.prompt';
import { extractionOutputSchema } from '../src/modules/ai/schemas/extracted-event.schema';

describe('AI extraction schema', () => {
  it('accepts valid structured extraction output', () => {
    const parsed = extractionOutputSchema.parse({
      events: [
        {
          type: 'task_created',
          title: 'Finish webhook integration test',
          summary: 'Alice committed to finish the webhook integration test today.',
          assigneeTelegramUserId: '77',
          dueDate: null,
          priority: null,
          confidence: 0.9,
          sourceMessageIds: [1002],
        },
      ],
    });

    expect(parsed.events[0]?.type).toBe('task_created');
  });

  it('rejects events without source message ids', () => {
    expect(() =>
      extractionOutputSchema.parse({
        events: [
          {
            type: 'decision',
            summary: 'The group decided to ship today.',
            confidence: 0.8,
            sourceMessageIds: [],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('buildExtractionPrompt', () => {
  it('includes evidence rules and Telegram source ids', () => {
    const prompt = buildExtractionPrompt({
      groupTitle: 'Engineering',
      topicName: 'Backend',
      periodStart: '2026-07-15T00:00:00.000Z',
      periodEnd: '2026-07-15T06:00:00.000Z',
      messages: [
        {
          groupId: 'group-1',
          topicId: 'topic-1',
          telegramMessageId: 1002,
          sentAt: '2026-07-15T01:00:00.000Z',
          telegramUserId: '77',
          displayName: 'Alice',
          text: 'I will finish the collector today',
          groupTitle: 'Engineering',
          topicName: 'Backend',
        },
      ],
    });

    expect(prompt).toContain('Only extract content that is directly evidenced');
    expect(prompt).toContain('message_id: 1002');
    expect(prompt).toContain('Open tasks:');
  });
});
