import { z } from 'zod';

export const extractedEventTypeSchema = z.enum([
  'task_created',
  'task_progress',
  'task_completed',
  'task_reopened',
  'blocker',
  'decision',
  'follow_up',
  'ignore',
]);

export const extractedEventSchema = z.object({
  type: extractedEventTypeSchema,
  title: z.string().min(1).optional(),
  summary: z.string().min(1),
  taskReference: z.string().min(1).optional(),
  assigneeTelegramUserId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable().optional(),
  confidence: z.number().min(0).max(1),
  sourceMessageIds: z.array(z.number()).min(1),
});

export const extractionOutputSchema = z.object({
  events: z.array(extractedEventSchema),
});

export type ExtractedEventType = z.infer<typeof extractedEventTypeSchema>;
export type ExtractedEvent = z.infer<typeof extractedEventSchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
