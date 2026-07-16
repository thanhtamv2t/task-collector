import type { ExtractionPromptMessage } from '../task-extractor.service';

export const EXTRACTION_PROMPT_VERSION = 'performance-evaluator-v3';

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
    'You are a performance evaluator for Telegram daily report messages.',
    'Your job is to identify concrete work evidence per sender inside the selected period.',
    '',
    'Rules:',
    '- Treat messages as performance evidence, not as task creation instructions.',
    '- Evaluate all messages in the selected period. Extract one event per concrete work result/update/blocker/decision.',
    '- Split dense daily reports into separate events. If one message says "đã sửa A, đã sửa B, thêm C", return 3 events.',
    '- Do not copy the whole message as one summary. Summarize each atomic work item separately.',
    '- The actor must be the sender of the message. Use the input user_id as assigneeTelegramUserId.',
    '- Ignore requests, plans, questions, bot setup chatter, commands, reminders, greetings, acknowledgements, and meta messages about the group/reporting process.',
    '- Ignore messages like "group này chỉ để report", "đã setup bot", "test", or operational chatter unless they include actual work done by the sender.',
    '- Classify shipped/fixed/done/finished/reviewed/released/merged/delivered/đã sửa/đã cập nhật/đã thêm/hoàn thành/xong items as task_completed.',
    '- Classify working/update/implement/add/investigate/in progress/đang làm/đang xem/chưa xong items as task_progress.',
    '- Classify explicit blocked/waiting/cannot items as blocker.',
    '- Classify decisions/agreements as decision.',
    '- Avoid task_created unless the sender explicitly reports newly started work; prefer task_progress for active work.',
    '- Every event must include sourceMessageIds matching Telegram message_id values from the input.',
    '- confidence must be a number between 0 and 1.',
    '- Return only JSON matching this shape: {"events":[...]}',
    '- Use type "ignore" for non-performance messages. Low-value meta chatter must be ignore, not needs-review.',
    '- Summaries should be concise Vietnamese if the input is Vietnamese; keep product/module names unchanged.',
    '- Prefer outcome wording: what changed, shipped, fixed, or remains in progress. Avoid vague summaries like "đã làm việc trên...".',
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
    'Existing task records are not used for this performance evaluation:',
    '[]',
    '',
    'Messages:',
    messages,
  ].join('\n');
}
