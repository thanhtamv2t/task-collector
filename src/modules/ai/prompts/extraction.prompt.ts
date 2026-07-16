import type { ExtractionPromptMessage } from '../task-extractor.service';

export const EXTRACTION_PROMPT_VERSION = 'task-extraction-v1';

export function buildExtractionPrompt(input: {
  groupTitle: string;
  topicName: string;
  periodStart: string;
  periodEnd: string;
  messages: ExtractionPromptMessage[];
}): string {
  const messages = input.messages
    .map((message) =>
      [
        `message_id: ${message.telegramMessageId}`,
        `sent_at: ${message.sentAt}`,
        `user_id: ${message.telegramUserId ?? 'unknown'}`,
        `display_name: ${message.displayName ?? 'unknown'}`,
        `text: ${message.text}`,
      ].join('\n'),
    )
    .join('\n\n');

  return [
    'You extract task events from Telegram group messages.',
    '',
    'Rules:',
    '- Only extract content that is directly evidenced by messages.',
    '- Do not guess assignees, due dates, task references, or priority.',
    '- Do not treat generic discussion or questions as tasks unless there is a clear commitment.',
    '- Distinguish new tasks, progress, completion, reopened work, blockers, decisions, and follow-ups.',
    '- Every event must include sourceMessageIds matching Telegram message_id values from the input.',
    '- confidence must be a number between 0 and 1.',
    '- Return only JSON matching this shape: {"events":[...]}',
    '- Use type "ignore" only when a message explicitly needs to be represented as ignored.',
    '',
    'Event schema:',
    '{',
    '  "type": "task_created|task_progress|task_completed|task_reopened|blocker|decision|follow_up|ignore",',
    '  "title": "optional short task title",',
    '  "summary": "required evidence-based summary",',
    '  "taskReference": "optional reference from the message",',
    '  "assigneeTelegramUserId": "string or null",',
    '  "dueDate": "ISO date string or null",',
    '  "priority": "low|medium|high|urgent|null",',
    '  "confidence": 0.0,',
    '  "sourceMessageIds": [123]',
    '}',
    '',
    `Group: ${input.groupTitle}`,
    `Topic: ${input.topicName}`,
    `Period: ${input.periodStart} to ${input.periodEnd}`,
    '',
    'Open tasks:',
    '[]',
    '',
    'Messages:',
    messages,
  ].join('\n');
}
