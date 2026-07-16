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
      `*Daily task report:* ${this.escape(input.title)}`,
      `*Period:* ${this.escape(input.periodStart.toISOString())} → ${this.escape(input.periodEnd.toISOString())}`,
      '',
      this.section('✅ Hoàn thành', input.structured.completed),
      this.section('🔄 Đang thực hiện', input.structured.inProgress),
      this.section('🆕 Task mới', input.structured.newTasks),
      this.section('⛔ Blocker', input.structured.blockers),
      this.section('📌 Quyết định', input.structured.decisions),
      this.section('⚠️ Cần xác nhận', input.structured.needsReview),
      this.section('👤 Chưa xác định người phụ trách', input.structured.unassigned),
      this.groupedSection('Theo topic', input.structured.byTopic),
      this.groupedSection('Theo user', input.structured.byUser),
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
        const label = this.escape(item.taskTitle ?? item.summary);
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
        ...group.items.map((item) => `\\- ${this.escape(item.taskTitle ?? item.summary)}`),
      ]),
      '',
    ].join('\n');
  }

  private escape(value: string): string {
    return value.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }
}
