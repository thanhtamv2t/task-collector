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
