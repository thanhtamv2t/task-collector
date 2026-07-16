import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { NormalizedTelegramMessage, TelegramUpdatePayload } from './telegram.types';

const userSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

const chatSchema = z.object({
  id: z.number(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
  title: z.string().optional(),
});

const messageSchema = z.object({
  message_id: z.number(),
  message_thread_id: z.number().optional(),
  from: userSchema.optional(),
  chat: chatSchema,
  date: z.number(),
  edit_date: z.number().optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  reply_to_message: z
    .object({
      message_id: z.number(),
    })
    .optional(),
});

const updateSchema = z.object({
  update_id: z.number(),
  message: messageSchema.optional(),
  edited_message: messageSchema.optional(),
});

@Injectable()
export class TelegramUpdateParser {
  parse(rawUpdate: unknown): NormalizedTelegramMessage | null {
    const update = updateSchema.parse(rawUpdate) as TelegramUpdatePayload;
    const message = update.message ?? update.edited_message;

    if (!message) {
      return null;
    }

    const text = (message.text ?? message.caption ?? '').trim();
    if (!text) {
      return null;
    }

    const isEdited = Boolean(update.edited_message);
    const from = message.from
      ? {
          telegramUserId: String(message.from.id),
          username: message.from.username ?? null,
          firstName: message.from.first_name ?? null,
          lastName: message.from.last_name ?? null,
          displayName: buildDisplayName(message.from),
          isBot: message.from.is_bot ?? false,
        }
      : null;

    return {
      updateId: update.update_id,
      isEdited,
      chatId: String(message.chat.id),
      chatTitle: message.chat.title ?? null,
      chatType: message.chat.type,
      threadId: message.message_thread_id === undefined ? null : String(message.message_thread_id),
      telegramMessageId: String(message.message_id),
      replyToMessageId:
        message.reply_to_message?.message_id === undefined
          ? null
          : String(message.reply_to_message.message_id),
      from,
      text,
      messageType: message.text ? 'text' : 'caption',
      sentAt: new Date(message.date * 1000),
      editedAt: message.edit_date ? new Date(message.edit_date * 1000) : null,
      rawPayload: update,
    };
  }
}

function buildDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username?: string;
}): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || user.username || String('unknown');
}
