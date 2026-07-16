import { createHash } from 'node:crypto';

export function normalizeTaskTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTaskEventHash(input: {
  taskId: string | null;
  groupId: string;
  topicId: string | null;
  eventType: string;
  sourceMessageIds: number[];
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        taskId: input.taskId,
        groupId: input.groupId,
        topicId: input.topicId,
        eventType: input.eventType,
        sourceMessageIds: [...input.sourceMessageIds].sort((a, b) => a - b),
      }),
    )
    .digest('hex');
}
