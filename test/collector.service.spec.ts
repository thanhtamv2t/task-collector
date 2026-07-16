import { describe, expect, it, vi } from 'vitest';
import { CollectorService } from '../src/modules/collector/collector.service';
import { NormalizedTelegramMessage } from '../src/modules/telegram/telegram.types';

describe('CollectorService commands', () => {
  it('allows only configured Telegram admins to run bot commands', async () => {
    const repository = {
      upsertGroup: vi.fn(),
      findGroupByChatId: vi.fn(),
    };
    const bot = {
      sendMessage: vi.fn().mockResolvedValue(1),
    };
    const service = new CollectorService(
      repository as never,
      bot as never,
      {} as never,
      {} as never,
      { timezone: 'Asia/Ho_Chi_Minh' } as never,
      { adminTelegramUserIds: ['351523859'] } as never,
    );

    const result = await service.collect(commandMessage('/setup', '999'));

    expect(result).toBe('command_handled');
    expect(bot.sendMessage).toHaveBeenCalledWith('-1001', 'Permission denied.', null);
    expect(repository.upsertGroup).not.toHaveBeenCalled();
  });
});

function commandMessage(text: string, telegramUserId: string): NormalizedTelegramMessage {
  return {
    updateId: 1,
    isEdited: false,
    chatId: '-1001',
    chatTitle: 'Engineering',
    chatType: 'supergroup',
    threadId: null,
    telegramMessageId: '10',
    replyToMessageId: null,
    from: {
      telegramUserId,
      username: 'member',
      firstName: 'Member',
      lastName: null,
      displayName: 'Member',
      isBot: false,
    },
    text,
    messageType: 'text',
    sentAt: new Date('2026-07-16T10:00:00.000Z'),
    editedAt: null,
    rawPayload: {
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: -1001, type: 'supergroup', title: 'Engineering' },
        from: { id: Number(telegramUserId), is_bot: false, first_name: 'Member' },
        date: 1,
        text,
      },
    },
  };
}
