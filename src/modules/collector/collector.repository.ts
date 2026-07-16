import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { messages, telegramGroups, telegramTopics, telegramUsers } from '../../database/schema';
import { NormalizedTelegramMessage } from '../telegram/telegram.types';

@Injectable()
export class CollectorRepository {
  constructor(private readonly database: DatabaseService) {}

  async findGroupByChatId(chatId: string) {
    const [group] = await this.database.db
      .select()
      .from(telegramGroups)
      .where(eq(telegramGroups.telegramChatId, chatId))
      .limit(1);
    return group ?? null;
  }

  async upsertGroup(input: {
    chatId: string;
    title: string | null;
    timezone: string;
    reportChatId: string | null;
  }) {
    const [group] = await this.database.db
      .insert(telegramGroups)
      .values({
        telegramChatId: input.chatId,
        title: input.title,
        reportChatId: input.reportChatId,
        timezone: input.timezone,
        isActive: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: telegramGroups.telegramChatId,
        set: {
          title: input.title,
          reportChatId: input.reportChatId,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return group;
  }

  async upsertUser(message: NormalizedTelegramMessage) {
    if (!message.from) {
      return null;
    }

    const [user] = await this.database.db
      .insert(telegramUsers)
      .values({
        telegramUserId: message.from.telegramUserId,
        username: message.from.username,
        firstName: message.from.firstName,
        lastName: message.from.lastName,
        displayName: message.from.displayName,
        isBot: message.from.isBot,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: telegramUsers.telegramUserId,
        set: {
          username: message.from.username,
          firstName: message.from.firstName,
          lastName: message.from.lastName,
          displayName: message.from.displayName,
          isBot: message.from.isBot,
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  }

  async findTopic(groupId: string, threadId: string | null) {
    const [topic] = await this.database.db
      .select()
      .from(telegramTopics)
      .where(and(eq(telegramTopics.groupId, groupId), this.threadCondition(threadId)))
      .limit(1);
    return topic ?? null;
  }

  async listTopics(groupId: string) {
    return this.database.db
      .select()
      .from(telegramTopics)
      .where(eq(telegramTopics.groupId, groupId));
  }

  async upsertTopic(input: {
    groupId: string;
    threadId: string | null;
    name: string | null;
    isMonitored: boolean;
  }) {
    const [topic] = await this.database.db
      .insert(telegramTopics)
      .values({
        groupId: input.groupId,
        telegramThreadId: input.threadId,
        name: input.name,
        isMonitored: input.isMonitored,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [telegramTopics.groupId, telegramTopics.telegramThreadId],
        set: {
          name: input.name,
          isMonitored: input.isMonitored,
          updatedAt: new Date(),
        },
      })
      .returning();

    return topic;
  }

  async setTopicMonitoring(groupId: string, threadId: string | null, isMonitored: boolean) {
    const [topic] = await this.database.db
      .update(telegramTopics)
      .set({
        isMonitored,
        updatedAt: new Date(),
      })
      .where(and(eq(telegramTopics.groupId, groupId), this.threadCondition(threadId)))
      .returning();
    return topic ?? null;
  }

  async saveMessage(input: {
    message: NormalizedTelegramMessage;
    groupId: string;
    topicId: string | null;
    userId: string | null;
  }): Promise<boolean> {
    const insert = this.database.db
      .insert(messages)
      .values({
        groupId: input.groupId,
        topicId: input.topicId,
        userId: input.userId,
        telegramMessageId: input.message.telegramMessageId,
        replyToMessageId: input.message.replyToMessageId,
        messageType: input.message.messageType,
        text: input.message.text,
        rawPayload: input.message.rawPayload,
        sentAt: input.message.sentAt,
        editedAt: input.message.editedAt,
        updatedAt: new Date(),
      });

    const inserted = input.message.isEdited
      ? await insert
          .onConflictDoUpdate({
            target: [messages.groupId, messages.telegramMessageId],
            set: {
              text: input.message.text,
              rawPayload: input.message.rawPayload,
              editedAt: input.message.editedAt,
              updatedAt: new Date(),
            },
          })
          .returning({ id: messages.id })
      : await insert
          .onConflictDoNothing({
            target: [messages.groupId, messages.telegramMessageId],
          })
          .returning({ id: messages.id });

    return inserted.length > 0;
  }

  private threadCondition(threadId: string | null) {
    return threadId === null
      ? isNull(telegramTopics.telegramThreadId)
      : eq(telegramTopics.telegramThreadId, threadId);
  }
}
