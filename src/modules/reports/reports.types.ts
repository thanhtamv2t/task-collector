export interface ReportItem {
  taskId: string | null;
  taskTitle: string | null;
  topicId: string | null;
  eventType: string;
  summary: string;
  topicName: string | null;
  actorDisplayName: string | null;
  assigneeDisplayName: string | null;
  sourceMessageIds: number[];
  confidence: string | null;
  createdAt: Date;
}

export interface ReportMessage {
  groupId: string;
  topicId: string | null;
  telegramMessageId: string;
  text: string | null;
  sentAt: Date;
  groupTitle: string | null;
  topicName: string | null;
  displayName: string | null;
  username: string | null;
  telegramUserId: string | null;
}

export interface StructuredReport {
  insights: ReportInsights;
  completed: ReportItem[];
  inProgress: ReportItem[];
  newTasks: ReportItem[];
  blockers: ReportItem[];
  decisions: ReportItem[];
  needsReview: ReportItem[];
  unassigned: ReportItem[];
  byTopic: Array<{ name: string; items: ReportItem[] }>;
  byUser: Array<{ name: string; items: ReportItem[] }>;
}

export interface ReportInsights {
  summary: string;
  highlights: string[];
  risks: string[];
  recommendations: string[];
  memberInsights: Array<{
    name: string;
    score: number;
    completed: number;
    progress: number;
    blockers: number;
    decisions: number;
    signal: string;
  }>;
  pmReview?: {
    executiveSummary: string;
    teamHealth: 'strong' | 'steady' | 'at_risk' | 'critical';
    keyThemes: string[];
    risks: string[];
    recommendations: string[];
    memberAssessments: Array<{
      name: string;
      rating: 'exceptional' | 'strong' | 'steady' | 'needs_attention' | 'insufficient_data';
      score: number;
      assessment: string;
      strengths: string[];
      concerns: string[];
      nextWeekFocus: string;
      monthlyEvaluationNote: string;
    }>;
  };
}
