import { describe, expect, it } from 'vitest';
import { TelegramUpdateParser } from '../src/modules/telegram/telegram-update.parser';

describe('TelegramUpdateParser', () => {
  const parser = new TelegramUpdateParser();

  it('normalizes text messages with topic and reply metadata', () => {
    const result = parser.parse({
      update_id: 100,
      message: {
        message_id: 55,
        message_thread_id: 12,
        chat: {
          id: -100123,
          type: 'supergroup',
          title: 'Engineering',
        },
        from: {
          id: 42,
          first_name: 'Ethan',
          username: 'ethan',
        },
        date: 1784110000,
        text: 'Ship the collector today',
        reply_to_message: {
          message_id: 54,
        },
      },
    });

    expect(result).toMatchObject({
      updateId: 100,
      chatId: '-100123',
      threadId: '12',
      telegramMessageId: '55',
      replyToMessageId: '54',
      text: 'Ship the collector today',
      messageType: 'text',
      from: {
        telegramUserId: '42',
        username: 'ethan',
        displayName: 'Ethan',
      },
    });
  });

  it('normalizes captions and edited messages', () => {
    const result = parser.parse({
      update_id: 101,
      edited_message: {
        message_id: 56,
        chat: {
          id: -100123,
          type: 'supergroup',
        },
        date: 1784110000,
        edit_date: 1784110300,
        caption: 'Updated blocker screenshot',
      },
    });

    expect(result?.isEdited).toBe(true);
    expect(result?.messageType).toBe('caption');
    expect(result?.editedAt?.toISOString()).toBe('2026-07-15T10:11:40.000Z');
  });

  it('ignores service-like updates and empty messages', () => {
    expect(parser.parse({ update_id: 102 })).toBeNull();
    expect(
      parser.parse({
        update_id: 103,
        message: {
          message_id: 57,
          chat: {
            id: -100123,
            type: 'supergroup',
          },
          date: 1784110000,
          text: '   ',
        },
      }),
    ).toBeNull();
  });
});
