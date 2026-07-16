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
        insights: {
          summary: '1 thành viên có report, 1 completed, 0 in-progress, 0 blocker.',
          highlights: ['Alice: 1 completed, 0 progress (Có output hoàn thành).'],
          risks: ['Không thấy blocker/risk rõ ràng trong report.'],
          recommendations: ['Tiếp tục tracking completion rate và blocker theo từng ngày.'],
          memberInsights: [
            {
              name: 'Alice',
              score: 3,
              completed: 1,
              progress: 0,
              blockers: 0,
              decisions: 0,
              signal: 'Có output hoàn thành',
            },
          ],
        },
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

    expect(content).toContain('Performance report');
    expect(content).toContain('Executive insights');
    expect(content).toContain('Highlights');
    expect(content).toContain('Performance by member');
    expect(content).toContain('✅ Completed work');
    expect(content).toContain('A task was completed\\. \\[src: 1002\\]');
    expect(content).toContain('⚠️ Cần review AI');
  });

  it('splits long Telegram messages', () => {
    const chunks = formatter.splitForTelegram(['a'.repeat(3000), 'b'.repeat(3000)].join('\n'));

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= formatter.maxTelegramMessageLength)).toBe(true);
  });
});
