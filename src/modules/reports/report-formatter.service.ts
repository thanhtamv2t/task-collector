import { Injectable } from '@nestjs/common';
import { StructuredReport, ReportItem } from './reports.types';

@Injectable()
export class ReportFormatterService {
  readonly maxTelegramMessageLength = 3900;

  format(input: {
    title: string;
    periodStart: Date;
    periodEnd: Date;
    structured: StructuredReport;
  }): string {
    return [
      `*Performance report:* ${this.escape(input.title)}`,
      `*Period:* ${this.escape(input.periodStart.toISOString())} → ${this.escape(input.periodEnd.toISOString())}`,
      '',
      this.insights(input.structured),
      '',
      this.performanceByUser(input.structured.byUser),
      this.section('✅ Completed work', input.structured.completed, 8),
      this.section('🔄 In progress', input.structured.inProgress, 8),
      this.section('⛔ Blocker', input.structured.blockers, 8),
      this.section('📌 Quyết định', input.structured.decisions, 8),
      this.section('⚠️ Cần review AI', input.structured.needsReview, 8),
    ]
      .filter(Boolean)
      .join('\n');
  }

  splitForTelegram(content: string): string[] {
    if (content.length <= this.maxTelegramMessageLength) {
      return [content];
    }

    const chunks: string[] = [];
    let current = '';

    for (const line of content.split('\n')) {
      if (current.length + line.length + 1 > this.maxTelegramMessageLength) {
        chunks.push(current.trimEnd());
        current = '';
      }

      current += `${line}\n`;
    }

    if (current.trim()) {
      chunks.push(current.trimEnd());
    }

    return chunks;
  }

  private section(title: string, items: ReportItem[], maxItems: number): string {
    if (items.length === 0) {
      return `*${this.escape(title)}*\n\\- Không có`;
    }

    const visibleItems = items.slice(0, maxItems);
    const omitted = items.length - visibleItems.length;

    return [
      `*${this.escape(title)}*`,
      ...visibleItems.map((item) => {
        const label = this.escape(item.summary);
        const sources = item.sourceMessageIds.length
          ? ` \\[src: ${this.escape(item.sourceMessageIds.join(', '))}\\]`
          : '';
        return `\\- ${label}${sources}`;
      }),
      ...(omitted > 0 ? [`\\- ${this.escape(`+ ${omitted} items khác; xem dashboard để xem đầy đủ`)}`] : []),
      '',
    ].join('\n');
  }

  private insights(report: StructuredReport): string {
    const insights = report.insights;
    const lines = [
      `*${this.escape('Executive insights')}*`,
      `\\- ${this.escape(insights.summary)}`,
      `*${this.escape('Highlights')}*`,
      ...insights.highlights.slice(0, 3).map((item) => `\\- ${this.escape(item)}`),
      `*${this.escape('Risks')}*`,
      ...insights.risks.slice(0, 3).map((item) => `\\- ${this.escape(item)}`),
      `*${this.escape('Recommended actions')}*`,
      ...insights.recommendations.slice(0, 3).map((item) => `\\- ${this.escape(item)}`),
    ];

    return lines.join('\n');
  }

  private groupedSection(title: string, groups: Array<{ name: string; items: ReportItem[] }>): string {
    if (groups.length === 0) {
      return '';
    }

    return [
      `*${this.escape(title)}*`,
      ...groups.flatMap((group) => [
        `_${this.escape(group.name)}_`,
        ...group.items.map((item) => `\\- ${this.escape(item.summary)}`),
      ]),
      '',
    ].join('\n');
  }

  private performanceByUser(groups: Array<{ name: string; items: ReportItem[] }>): string {
    if (groups.length === 0) {
      return `*${this.escape('Performance by member')}*\n\\- Không có dữ liệu daily report trong khoảng đã chọn`;
    }

    return [
      `*${this.escape('Performance by member')}*`,
      ...groups.map((group) => {
        const completed = group.items.filter((item) => item.eventType === 'task_completed');
        const progress = group.items.filter((item) => item.eventType === 'task_progress');
        const blockers = group.items.filter((item) => item.eventType === 'blocker');
        const decisions = group.items.filter((item) => item.eventType === 'decision');
        const sample = completed.slice(0, 3).map((item) => `  • ${this.escape(item.summary)}`);
        const omitted = completed.length - Math.min(completed.length, 3);

        return [
          `_${this.escape(group.name)}_`,
          `\\- Done: ${completed.length} \\| Progress: ${progress.length} \\| Blocker: ${blockers.length} \\| Decision: ${decisions.length}`,
          ...sample,
          ...(omitted > 0 ? [`  • ${this.escape(`+ ${omitted} completed items khác; xem dashboard`)}`] : []),
        ].join('\n');
      }),
      '',
    ].join('\n');
  }

  private escape(value: string): string {
    return value.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }
}
