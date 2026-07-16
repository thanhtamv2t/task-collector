import { describe, expect, it } from 'vitest';
import { ReportFormatterService } from '../src/modules/reports/report-formatter.service';

describe('ReportFormatterService', () => {
  const formatter = new ReportFormatterService();

  it('renders all required report sections with source references', () => {
    const content = formatter.format({
      title: 'Engineering',
      periodStart: new Date('2026-07-15T00:00:00.000Z'),
      periodEnd: new Date('2026-07-15T06:00:00.000Z'),
      structured: {
        completed: [
          {
            taskId: 'task-1',
            taskTitle: 'Finish report generator',
            eventType: 'task_completed',
            summary: 'A task was completed.',
            topicName: 'Backend',
            actorDisplayName: 'Alice',
            assigneeDisplayName: 'Alice',
            sourceMessageIds: [1002],
            confidence: '0.900',
            createdAt: new Date('2026-07-15T01:00:00.000Z'),
          },
        ],
        inProgress: [],
        newTasks: [],
        blockers: [],
        decisions: [],
        needsReview: [],
        unassigned: [],
        byTopic: [
          {
            name: 'Backend',
            items: [],
          },
        ],
        byUser: [
          {
            name: 'Alice',
            items: [
              {
                taskId: 'task-1',
                taskTitle: 'Finish report generator',
                eventType: 'task_completed',
                summary: 'A task was completed.',
                topicName: 'Backend',
                actorDisplayName: 'Alice',
                assigneeDisplayName: 'Alice',
                sourceMessageIds: [1002],
                confidence: '0.900',
                createdAt: new Date('2026-07-15T01:00:00.000Z'),
              },
            ],
          },
        ],
      },
    });

    expect(content).toContain('Weekly performance report');
    expect(content).toContain('Performance theo user');
    expect(content).toContain('✅ Hoàn thành');
    expect(content).toContain('Finish report generator \\[src: 1002\\]');
    expect(content).toContain('⚠️ Cần review AI');
  });

  it('splits long Telegram messages', () => {
    const chunks = formatter.splitForTelegram(['a'.repeat(3000), 'b'.repeat(3000)].join('\n'));

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= formatter.maxTelegramMessageLength)).toBe(true);
  });
});
