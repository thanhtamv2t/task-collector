export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel';

export interface TelegramUserPayload {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChatPayload {
  id: number;
  type: TelegramChatType;
  title?: string;
}

export interface TelegramMessagePayload {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUserPayload;
  chat: TelegramChatPayload;
  date: number;
  edit_date?: number;
  text?: string;
  caption?: string;
  reply_to_message?: {
    message_id: number;
  };
}

export interface TelegramUpdatePayload {
  update_id: number;
  message?: TelegramMessagePayload;
  edited_message?: TelegramMessagePayload;
}

export interface NormalizedTelegramMessage {
  updateId: number;
  isEdited: boolean;
  chatId: string;
  chatTitle: string | null;
  chatType: TelegramChatType;
  threadId: string | null;
  telegramMessageId: string;
  replyToMessageId: string | null;
  from: {
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    isBot: boolean;
  } | null;
  text: string;
  messageType: 'text' | 'caption';
  sentAt: Date;
  editedAt: Date | null;
  rawPayload: TelegramUpdatePayload;
}
