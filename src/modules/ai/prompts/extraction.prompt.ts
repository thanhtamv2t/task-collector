import type { ExtractionPromptMessage } from '../task-extractor.service';

export const EXTRACTION_PROMPT_VERSION = 'daily-report-performance-v1';

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
    'You extract daily work report items from Telegram group messages.',
    '',
    'Rules:',
    '- Treat each user message as that user daily report when it contains a date and bullet/list-like work items, or clearly reports completed/in-progress work.',
    '- Extract one event per reported work item when possible.',
    '- The actor/assignee must be the sender of the message. Use the input user_id as assigneeTelegramUserId.',
    '- Do not create tasks for requests, plans, or questions unless the user reports they worked on it.',
    '- Classify shipped/fixed/done/finished/reviewed items as task_completed.',
    '- Classify working/update/implement/add/investigate/in progress items as task_progress.',
    '- Classify explicit blocked/waiting/cannot items as blocker.',
    '- Classify decisions/agreements as decision.',
    '- Use task_created only when a user reports a newly started work item that is not yet progress/completion.',
    '- Every event must include sourceMessageIds matching Telegram message_id values from the input.',
    '- confidence must be a number between 0 and 1.',
    '- Return only JSON matching this shape: {"events":[...]}',
    '- Use type "ignore" for greetings, acknowledgements, setup chatter, empty media, or non-report messages.',
    '- Summaries should be concise Vietnamese if the input is Vietnamese; keep product/module names unchanged.',
    '',
    'Event schema:',
    '{',
    '  "type": "task_created|task_progress|task_completed|task_reopened|blocker|decision|follow_up|ignore",',
    '  "title": "optional short work item title",',
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
    'Existing tasks are not authoritative for daily performance reports:',
    '[]',
    '',
    'Messages:',
    messages,
  ].join('\n');
}
