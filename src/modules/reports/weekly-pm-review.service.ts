import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterClient } from '../ai/openrouter.client';
import { ReportInsights } from './reports.types';

const pmReviewSchema = z.object({
  executiveSummary: z.string().min(1),
  teamHealth: z.enum(['strong', 'steady', 'at_risk', 'critical']),
  keyThemes: z.array(z.string().min(1)).max(5),
  risks: z.array(z.string().min(1)).max(5),
  recommendations: z.array(z.string().min(1)).max(5),
  memberAssessments: z.array(
    z.object({
      name: z.string().min(1),
      rating: z.enum(['exceptional', 'strong', 'steady', 'needs_attention', 'insufficient_data']),
      score: z.number().min(0).max(100),
      assessment: z.string().min(1),
      strengths: z.array(z.string().min(1)).max(4),
      concerns: z.array(z.string().min(1)).max(4),
      nextWeekFocus: z.string().min(1),
      monthlyEvaluationNote: z.string().min(1),
    }),
  ),
});

export type WeeklyPmReview = z.infer<typeof pmReviewSchema>;

@Injectable()
export class WeeklyPmReviewService {
  constructor(private readonly openRouter: OpenRouterClient) {}

  async review(input: {
    groupTitle: string;
    periodStart: Date;
    periodEnd: Date;
    insights: ReportInsights;
    byUser: Array<{ name: string; items: Array<{ eventType: string; summary: string }> }>;
  }): Promise<WeeklyPmReview> {
    const fallback = this.fallback(input.insights);
    if (!this.openRouter.isConfigured() || input.byUser.length === 0) {
      return fallback;
    }

    const evidence = input.byUser
      .map((member) => {
        const items = member.items.map((item) => `- ${item.eventType}: ${item.summary}`).join('\n');
        return `MEMBER: ${member.name}\n${items || '- No concrete evidence'}`;
      })
      .join('\n\n');

    const prompt = [
      'You are a pragmatic engineering PM reviewing a weekly daily-report digest.',
      'Evaluate performance and management signals, not message volume or task count.',
      'Use only the evidence supplied. Never invent delivery, quality, effort, or intent.',
      'A completed item is stronger evidence than an activity update. Penalize blockers and repeated unfinished work.',
      'A member with no evidence must receive insufficient_data, never a negative performance judgment.',
      'Write concise Vietnamese when evidence is Vietnamese.',
      'The monthlyEvaluationNote must be useful as a weekly observation that can accumulate into a monthly review.',
      'Return JSON only with this exact shape:',
      '{"executiveSummary":"...","teamHealth":"strong|steady|at_risk|critical","keyThemes":["..."],"risks":["..."],"recommendations":["..."],"memberAssessments":[{"name":"...","rating":"exceptional|strong|steady|needs_attention|insufficient_data","score":0,"assessment":"...","strengths":["..."],"concerns":["..."],"nextWeekFocus":"...","monthlyEvaluationNote":"..."}]}',
      '',
      `Group: ${input.groupTitle}`,
      `Period: ${input.periodStart.toISOString()} to ${input.periodEnd.toISOString()}`,
      `Heuristic totals: ${input.insights.summary}`,
      `Existing risks: ${input.insights.risks.join(' | ')}`,
      '',
      'Evidence by member:',
      evidence,
    ].join('\n');

    try {
      const response = await this.openRouter.extractJson(prompt);
      return pmReviewSchema.parse(JSON.parse(response.content));
    } catch {
      return fallback;
    }
  }

  private fallback(insights: ReportInsights): WeeklyPmReview {
    const memberAssessments = insights.memberInsights.map((member) => {
      const score = Math.max(0, Math.min(100, member.completed * 12 + member.decisions * 8 + member.progress * 4 - member.blockers * 15));
      const rating = member.blockers > 0
        ? 'needs_attention'
        : member.completed >= 5
          ? 'strong'
          : member.completed > 0 || member.progress > 0
            ? 'steady'
            : 'insufficient_data';
      return {
        name: member.name,
        rating: rating as WeeklyPmReview['memberAssessments'][number]['rating'],
        score,
        assessment: member.signal,
        strengths: member.completed > 0 ? [`Đã ghi nhận ${member.completed} kết quả hoàn thành.`] : [],
        concerns: member.blockers > 0 ? [`Có ${member.blockers} blocker cần được gỡ.`] : member.progress > member.completed ? ['Cần làm rõ outcome của các việc đang thực hiện.'] : [],
        nextWeekFocus: member.blockers > 0 ? 'Ưu tiên xử lý blocker và chốt ETA.' : 'Tiếp tục ghi rõ outcome và tác động của công việc.',
        monthlyEvaluationNote: `Tín hiệu tuần này: ${member.signal}. Cần đối chiếu thêm với các tuần kế tiếp trước khi kết luận tháng.`,
      };
    });
    const teamHealth = insights.memberInsights.some((member) => member.blockers > 0)
      ? 'at_risk'
      : insights.memberInsights.some((member) => member.completed > 0)
        ? 'steady'
        : 'insufficient_data';
    return {
      executiveSummary: insights.summary,
      teamHealth: teamHealth === 'insufficient_data' ? 'at_risk' : teamHealth,
      keyThemes: insights.highlights.slice(0, 3),
      risks: insights.risks.slice(0, 3),
      recommendations: insights.recommendations.slice(0, 3),
      memberAssessments,
    };
  }
}
