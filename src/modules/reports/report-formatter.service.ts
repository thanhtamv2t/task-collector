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
      this.performanceByUser(input.structured.byUser),
      this.section('✅ Completed work', input.structured.completed),
      this.section('🔄 In progress', input.structured.inProgress),
      this.section('⛔ Blocker', input.structured.blockers),
      this.section('📌 Quyết định', input.structured.decisions),
      this.section('⚠️ Cần review AI', input.structured.needsReview),
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

  private section(title: string, items: ReportItem[]): string {
    if (items.length === 0) {
      return `*${this.escape(title)}*\n\\- Không có`;
    }

    return [
      `*${this.escape(title)}*`,
      ...items.map((item) => {
        const label = this.escape(item.summary);
        const sources = item.sourceMessageIds.length
          ? ` \\[src: ${this.escape(item.sourceMessageIds.join(', '))}\\]`
          : '';
        return `\\- ${label}${sources}`;
      }),
      '',
    ].join('\n');
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
        const sample = completed.slice(0, 6).map((item) => `  • ${this.escape(item.summary)}`);

        return [
          `_${this.escape(group.name)}_`,
          `\\- Done: ${completed.length} \\| Progress: ${progress.length} \\| Blocker: ${blockers.length} \\| Decision: ${decisions.length}`,
          ...sample,
        ].join('\n');
      }),
      '',
    ].join('\n');
  }

  private escape(value: string): string {
    return value.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }
}
