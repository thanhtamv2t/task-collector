import {
  Activity,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileText,
  Gauge,
  Github,
  Layers3,
  LogOut,
  MessageSquareText,
  Play,
  RefreshCw,
  Search,
  Send,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Metrics = {
  messages: { collected: number; pending: number; processing: number; processed: number; failed: number };
  ai: { runs: number; failures: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  tasks: { created: number; eventsCreated: number };
  reports: { sent: number; failed: number };
  jobs: { batches: number; failedBatches: number; averageDurationMs: number | null };
};

type GroupRow = {
  id: string;
  title: string | null;
  telegramChatId: string;
  isActive: boolean;
  timezone: string;
  topicCount: number;
  monitoredTopicCount: number;
  messageCount: number;
};

type TopicRow = {
  id: string;
  groupTitle: string | null;
  name: string | null;
  telegramThreadId: string | null;
  isMonitored: boolean;
  messageCount: number;
};

type ReportRow = {
  id: string;
  reportType: string;
  status: string;
  groupTitle: string | null;
  periodStart: string;
  periodEnd: string;
  telegramMessageId: string | null;
  content: string | null;
  structuredContent: StructuredReport | null;
  sentAt: string | null;
  createdAt: string;
};

type StructuredReport = {
  insights?: ReportInsights;
  completed?: ReportItem[];
  inProgress?: ReportItem[];
  blockers?: ReportItem[];
  decisions?: ReportItem[];
  needsReview?: ReportItem[];
  byUser?: Array<{ name: string; items: ReportItem[] }>;
};

type ReportInsights = {
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
};

type ReportItem = {
  eventType: string;
  summary: string;
  sourceMessageIds: number[];
  confidence: string | null;
  createdAt: string;
};

type MessageRow = {
  id: string;
  telegramMessageId: string;
  messageType: string;
  text: string | null;
  processingStatus: string;
  groupTitle: string | null;
  topicName: string | null;
  sender: string | null;
  senderUsername: string | null;
  sentAt: string;
};

type JobRow = {
  id: string;
  jobType: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AiRunRow = {
  id: string;
  runType: string;
  model: string;
  status: string;
  groupTitle: string | null;
  topicName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: string | null;
  errorMessage: string | null;
  startedAt: string;
};

type AuthUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  expiresAt: number;
};

type DashboardData = {
  metrics: Metrics | null;
  groups: GroupRow[];
  topics: TopicRow[];
  reports: ReportRow[];
  messages: MessageRow[];
  jobs: JobRow[];
  aiRuns: AiRunRow[];
  performance: PerformanceResponse | null;
};

type CleanDerivedResult = {
  deletedReports: number;
  deletedAiRuns: number;
  deletedJobBatches: number;
  deletedTaskEvents: number;
  deletedTasks: number;
  preservedMessages: boolean;
};

type Toast = {
  id: number;
  tone: 'success' | 'error' | 'info';
  title: string;
  description?: string;
};

type PerformanceRow = {
  periodStart: string;
  periodEnd: string;
  memberName: string;
  username: string | null;
  telegramUserId: string | null;
  totalItems: number;
  completedItems: number;
  progressItems: number;
  blockerItems: number;
  decisionItems: number;
  lastActivityAt: string;
  items: Array<{
    summary: string;
    eventType: string;
    sourceMessageIds: number[];
    occurredAt: string;
  }>;
};

type PerformanceResponse = {
  mode: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: PerformanceRow[];
};

const initialData: DashboardData = {
  metrics: null,
  groups: [],
  topics: [],
  reports: [],
  messages: [],
  jobs: [],
  aiRuns: [],
  performance: null,
};

const navItems = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'performance', label: 'Performance', icon: CalendarDays },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquareText },
  { id: 'jobs', label: 'Jobs', icon: Activity },
] as const;

type SectionId = (typeof navItems)[number]['id'];

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function App() {
  const initialReportId = new URLSearchParams(window.location.search).get('reportId');
  const [active, setActive] = useState<SectionId>(initialReportId ? 'reports' : 'overview');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(initialReportId);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'day' | 'week' | 'month'>('week');
  const [performancePage, setPerformancePage] = useState(1);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(Boolean(initialReportId));
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [cleaningDerived, setCleaningDerived] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metrics, groups, topics, reports, messages, jobs, aiRuns, performance] = await Promise.all([
        getJson<Metrics>('/internal/metrics'),
        getJson<GroupRow[]>('/internal/dashboard/groups'),
        getJson<TopicRow[]>('/internal/dashboard/topics'),
        getJson<ReportRow[]>('/internal/dashboard/reports'),
        getJson<MessageRow[]>('/internal/dashboard/messages'),
        getJson<JobRow[]>('/internal/dashboard/jobs'),
        getJson<AiRunRow[]>('/internal/dashboard/ai-runs'),
        getJson<PerformanceResponse>(
          `/internal/dashboard/performance?mode=${performanceMode}&page=${performancePage}&pageSize=12`,
        ),
      ]);
      setData({ metrics, groups, topics, reports, messages, jobs, aiRuns, performance });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null);
      }
      setError(err instanceof Error ? err.message : 'Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [performanceMode, performancePage]);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionUser = await getJson<AuthUser>('/auth/me');
      setUser(sessionUser);
      await load();
    } catch (err) {
      setUser(null);
      setError(err instanceof Error && !err.message.startsWith('401') ? err.message : null);
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const runJob = async (job: 'extract' | 'report' | 'retry-failed' | 'retention') => {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/internal/jobs/${job}`);
      pushToast({
        tone: 'success',
        title: 'Job queued',
        description: job,
      });
      await load();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null);
      }
      setError(err instanceof Error ? err.message : `Unable to trigger ${job}`);
      pushToast({
        tone: 'error',
        title: `Unable to trigger ${job}`,
        description: err instanceof Error ? err.message : undefined,
      });
      setLoading(false);
    }
  };

  const generateReport = async (input: {
    groupId: string;
    periodStart: string;
    periodEnd: string;
    reportType: string;
  }) => {
    setGeneratingReport(true);
    setError(null);
    try {
      const result = await postJson<{ reportId: string }>('/internal/dashboard/reports/generate', input);
      setSelectedReportId(result.reportId);
      setReportDrawerOpen(true);
      setActive('reports');
      pushToast({
        tone: 'success',
        title: 'Report generated',
        description: 'Opened in drawer',
      });
      await load();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null);
      }
      setError(err instanceof Error ? err.message : 'Unable to generate report');
      pushToast({
        tone: 'error',
        title: 'Unable to generate report',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const cleanDerivedData = async () => {
    setCleaningDerived(true);
    setError(null);
    try {
      const result = await postJson<CleanDerivedResult>('/internal/dashboard/cleanup-derived');
      setMaintenanceOpen(false);
      setReportDrawerOpen(false);
      setSelectedReportId(null);
      pushToast({
        tone: 'success',
        title: 'Derived data cleaned',
        description: `${result.deletedReports} reports, ${result.deletedAiRuns} AI runs, ${result.deletedJobBatches} jobs removed. Messages preserved.`,
      });
      await load();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null);
      }
      setError(err instanceof Error ? err.message : 'Unable to clean derived data');
      pushToast({
        tone: 'error',
        title: 'Cleanup failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCleaningDerived(false);
    }
  };

  const filtered = useMemo(() => filterData(data, query), [data, query]);
  const metrics = data.metrics;

  if (user === undefined) {
    return <AuthScreen loading={loading} error={error} />;
  }

  if (!user) {
    return <AuthScreen error={error} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Bot size={20} />
          </div>
          <div>
            <strong>Performance Reporter</strong>
            <span>Performance Console</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Dashboard sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setActive(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <Shield size={18} />
          <div>
            <strong>GitHub Admin</strong>
            <span>@{user.login}</span>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Telegram Performance Reporter</h1>
            <p>Create performance reports, inspect member evidence, and monitor collection health.</p>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tables" />
            </div>
            <button className="icon-button" onClick={load} disabled={loading} type="button" title="Refresh">
              <RefreshCw size={18} className={loading ? 'spin' : undefined} />
            </button>
            <a className="icon-link" href={`${apiBase}/auth/logout`} title="Logout">
              <LogOut size={18} />
            </a>
          </div>
        </header>

        <div className="session-bar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <Shield size={16} />}
          <strong>{user.name ?? user.login}</strong>
          <span>GitHub admin session</span>
          <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Not loaded yet'}</span>
        </div>

        {error ? (
          <div className="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {active === 'overview' ? (
          <Overview
            data={data}
            metrics={metrics}
            onRunJob={runJob}
            onOpenMaintenance={() => setMaintenanceOpen(true)}
          />
        ) : null}
        {active === 'performance' ? (
          <Performance
            performance={data.performance}
            mode={performanceMode}
            onModeChange={(mode) => {
              setPerformanceMode(mode);
              setPerformancePage(1);
            }}
            onPageChange={setPerformancePage}
          />
        ) : null}
        {active === 'groups' ? <Groups groups={filtered.groups} topics={filtered.topics} /> : null}
        {active === 'reports' ? (
          <Reports
            groups={data.groups}
            reports={filtered.reports}
            selectedReportId={selectedReportId}
            generating={generatingReport}
            onGenerate={generateReport}
            onSelectReport={(reportId) => {
              setSelectedReportId(reportId);
              setReportDrawerOpen(true);
            }}
          />
        ) : null}
        {active === 'messages' ? <Messages messages={filtered.messages} /> : null}
        {active === 'jobs' ? <Jobs jobs={filtered.jobs} onRunJob={runJob} /> : null}
      </main>
      <ReportDrawer
        report={data.reports.find((report) => report.id === selectedReportId) ?? null}
        open={reportDrawerOpen}
        onClose={() => setReportDrawerOpen(false)}
      />
      <MaintenanceDrawer
        open={maintenanceOpen}
        cleaning={cleaningDerived}
        onClose={() => setMaintenanceOpen(false)}
        onClean={cleanDerivedData}
      />
      <Toaster toasts={toasts} />
    </div>
  );
}

function AuthScreen({ loading = false, error }: { loading?: boolean; error?: string | null }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <Bot size={22} />
        </div>
        <h1>Performance Reporter Admin</h1>
        <p>Sign in with the GitHub account configured as dashboard admin.</p>
        <a className="github-login" href={`${apiBase}/auth/github`}>
          <Github size={18} />
          <span>{loading ? 'Checking session' : 'Continue with GitHub'}</span>
        </a>
        {error ? (
          <div className="alert compact-alert">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Overview({
  data,
  metrics,
  onRunJob,
  onOpenMaintenance,
}: {
  data: DashboardData;
  metrics: Metrics | null;
  onRunJob: (job: 'extract' | 'report' | 'retry-failed' | 'retention') => void;
  onOpenMaintenance: () => void;
}) {
  const cards = [
    { label: 'Messages collected', value: metrics?.messages.collected ?? 0, icon: MessageSquareText },
    { label: 'Completed items', value: data.performance?.rows.reduce((sum, row) => sum + row.completedItems, 0) ?? 0, icon: CheckCircle2 },
    { label: 'Reports created', value: data.reports.length, icon: FileText },
    { label: 'AI evaluations', value: metrics?.ai.runs ?? 0, icon: BrainCircuit },
  ];

  return (
    <section className="stack">
      <div className="metric-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="metric-card" key={card.label}>
              <div>
                <span>{card.label}</span>
                <strong>{formatNumber(card.value)}</strong>
              </div>
              <Icon size={22} />
            </article>
          );
        })}
      </div>

      <div className="split-grid">
        <Panel title="Runtime Snapshot" icon={Database}>
          <div className="health-list">
            <HealthRow label="Pending messages" value={metrics?.messages.pending ?? 0} />
            <HealthRow label="Processed messages" value={metrics?.messages.processed ?? 0} />
            <HealthRow label="Failed AI runs" value={metrics?.ai.failures ?? 0} danger={(metrics?.ai.failures ?? 0) > 0} />
            <HealthRow label="Failed reports" value={metrics?.reports.failed ?? 0} danger={(metrics?.reports.failed ?? 0) > 0} />
            <HealthRow label="Failed batches" value={metrics?.jobs.failedBatches ?? 0} danger={(metrics?.jobs.failedBatches ?? 0) > 0} />
          </div>
        </Panel>

        <Panel title="Manual Controls" icon={Play}>
          <div className="button-grid">
            <button type="button" onClick={() => onRunJob('extract')}>Run extraction</button>
            <button type="button" onClick={() => onRunJob('retry-failed')}>Retry failed</button>
            <button type="button" onClick={() => onRunJob('retention')}>Run retention</button>
            <button type="button" className="danger-button" onClick={onOpenMaintenance}>
              Clean derived data
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Recent Performance" icon={CalendarDays}>
        <DataTable
          columns={['Member', 'Done', 'Progress', 'Blockers', 'Period']}
          rows={(data.performance?.rows ?? []).slice(0, 8).map((row) => [
            userLabel(row.memberName, row.username),
            row.completedItems,
            row.progressItems,
            row.blockerItems,
            `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`,
          ])}
        />
      </Panel>
    </section>
  );
}

function Performance({
  performance,
  mode,
  onModeChange,
  onPageChange,
}: {
  performance: PerformanceResponse | null;
  mode: 'day' | 'week' | 'month';
  onModeChange: (mode: 'day' | 'week' | 'month') => void;
  onPageChange: (page: number) => void;
}) {
  const rows = performance?.rows ?? [];
  return (
    <section className="stack">
      <Panel title="Performance Calendar" icon={CalendarDays}>
        <div className="panel-toolbar">
          <div className="segmented">
            {(['day', 'week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={mode === option ? 'active' : undefined}
                onClick={() => onModeChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="pagination">
            <button
              type="button"
              disabled={!performance || performance.page <= 1}
              onClick={() => onPageChange((performance?.page ?? 1) - 1)}
            >
              Prev
            </button>
            <span>
              Page {performance?.page ?? 1}/{performance?.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={!performance || performance.page >= performance.totalPages}
              onClick={() => onPageChange((performance?.page ?? 1) + 1)}
            >
              Next
            </button>
          </div>
        </div>
        <div className="performance-grid">
          {rows.length === 0 ? (
            <div className="empty">No performance data</div>
          ) : (
            rows.map((row) => (
              <article className="performance-card" key={`${row.periodStart}-${row.telegramUserId ?? row.memberName}`}>
                <div className="performance-head">
                  <div>
                    <strong>{userLabel(row.memberName, row.username)}</strong>
                    <span>{formatDate(row.periodStart)} - {formatDate(row.periodEnd)}</span>
                  </div>
                  <StatusBadge value={`${row.totalItems} items`} />
                </div>
                <div className="score-row">
                  <span>Done <strong>{row.completedItems}</strong></span>
                  <span>Progress <strong>{row.progressItems}</strong></span>
                  <span>Blocker <strong>{row.blockerItems}</strong></span>
                  <span>Decision <strong>{row.decisionItems}</strong></span>
                </div>
                <ul className="work-list">
                  {row.items.slice(0, 5).map((item, index) => (
                    <li key={index}>
                      <StatusBadge value={item.eventType.replace('task_', '')} />
                      <span>{item.summary}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      </Panel>
    </section>
  );
}

function Groups({ groups, topics }: { groups: GroupRow[]; topics: TopicRow[] }) {
  return (
    <section className="stack">
      <Panel title="Groups" icon={Users}>
        <DataTable
          columns={['Group', 'Chat ID', 'Topics', 'Messages', 'Status']}
          rows={groups.map((group) => [
            group.title ?? 'Untitled group',
            group.telegramChatId,
            `${group.monitoredTopicCount}/${group.topicCount}`,
            formatNumber(group.messageCount),
            <StatusBadge key="active" value={group.isActive ? 'active' : 'inactive'} />,
          ])}
        />
      </Panel>

      <Panel title="Topics" icon={Layers3}>
        <DataTable
          columns={['Topic', 'Group', 'Thread', 'Messages', 'Watch']}
          rows={topics.map((topic) => [
            topic.name ?? 'General',
            topic.groupTitle ?? 'Unknown',
            topic.telegramThreadId ?? 'none',
            formatNumber(topic.messageCount),
            <StatusBadge key="watch" value={topic.isMonitored ? 'watched' : 'off'} />,
          ])}
        />
      </Panel>
    </section>
  );
}

function Reports({
  groups,
  reports,
  selectedReportId,
  generating,
  onGenerate,
  onSelectReport,
}: {
  groups: GroupRow[];
  reports: ReportRow[];
  selectedReportId: string | null;
  generating: boolean;
  onGenerate: (input: { groupId: string; periodStart: string; periodEnd: string; reportType: string }) => void;
  onSelectReport: (reportId: string) => void;
}) {
  const defaultGroupId = groups[0]?.id ?? '';
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [preset, setPreset] = useState<'today' | 'week' | 'full' | 'custom'>('week');
  const [customStart, setCustomStart] = useState(toDatetimeLocal(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(toDatetimeLocal(new Date()));
  const range = reportRange(preset, customStart, customEnd);

  useEffect(() => {
    if (!groupId && defaultGroupId) {
      setGroupId(defaultGroupId);
    }
  }, [defaultGroupId, groupId]);

  return (
    <section className="stack">
      <Panel title="Create Performance Report" icon={Play}>
        <div className="report-builder">
          <label>
            <span>Group</span>
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title ?? group.telegramChatId}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Range</span>
            <select value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)}>
              <option value="today">Today</option>
              <option value="week">Week to date</option>
              <option value="full">Full history to now</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {preset === 'custom' ? (
            <>
              <label>
                <span>Start</span>
                <input type="datetime-local" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </label>
              <label>
                <span>End</span>
                <input type="datetime-local" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </label>
            </>
          ) : null}
          <button
            type="button"
            disabled={!groupId || generating}
            onClick={() =>
              onGenerate({
                groupId,
                periodStart: range.start.toISOString(),
                periodEnd: range.end.toISOString(),
                reportType: preset === 'today' ? 'daily_performance' : 'performance',
              })
            }
          >
            {generating ? 'Generating' : 'Generate report'}
          </button>
        </div>
        <div className="range-note">
          {formatDateTime(range.start.toISOString())} - {formatDateTime(range.end.toISOString())}
        </div>
      </Panel>

      <Panel title="Reports" icon={FileText}>
        <DataTable
          columns={['Type', 'Status', 'Group', 'Period', 'Created', 'Open']}
          rows={reports.map((report) => [
            report.reportType,
            <StatusBadge key="status" value={report.status} />,
            report.groupTitle ?? 'Unknown',
            `${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
            formatDate(report.createdAt),
            <button
              key="open"
              type="button"
              className={selectedReportId === report.id ? 'active-row-button' : undefined}
              onClick={() => onSelectReport(report.id)}
            >
              View
            </button>,
          ])}
        />
      </Panel>
    </section>
  );
}

function ReportDrawer({
  report,
  open,
  onClose,
}: {
  report: ReportRow | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} title="Report Detail" onClose={onClose}>
      {report ? (
        <>
          <div className="report-detail">
            <div>
              <strong>{report.groupTitle ?? 'Unknown group'}</strong>
              <span>{formatDateTime(report.periodStart)} - {formatDateTime(report.periodEnd)}</span>
            </div>
            <StatusBadge value={report.status} />
          </div>
          <ReportInsightsPanel report={report} />
          <MemberBreakdown report={report} />
          {report.content ? <pre className="report-preview">{report.content}</pre> : null}
        </>
      ) : (
        <div className="empty">No report selected</div>
      )}
    </Drawer>
  );
}

function MaintenanceDrawer({
  open,
  cleaning,
  onClose,
  onClean,
}: {
  open: boolean;
  cleaning: boolean;
  onClose: () => void;
  onClean: () => void;
}) {
  return (
    <Drawer open={open} title="Maintenance" onClose={onClose}>
      <div className="maintenance-panel">
        <div className="maintenance-icon">
          <Trash2 size={20} />
        </div>
        <h3>Clean derived data</h3>
        <p>
          Deletes generated reports, AI runs, job batches, task events, and old task rows. Telegram
          messages, groups, topics, and users are preserved.
        </p>
        <div className="maintenance-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="danger-button solid" disabled={cleaning} onClick={onClean}>
            {cleaning ? 'Cleaning' : 'Clean derived data'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button className="drawer-scrim" type="button" aria-label="Close drawer" onClick={onClose} />
      <aside className="drawer-panel">
        <header className="drawer-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone}`} key={toast.id}>
          <strong>{toast.title}</strong>
          {toast.description ? <span>{toast.description}</span> : null}
        </div>
      ))}
    </div>
  );
}

function ReportInsightsPanel({ report }: { report: ReportRow }) {
  const insights = report.structuredContent?.insights;

  if (!insights) {
    return null;
  }

  return (
    <div className="insight-grid">
      <article className="insight-card wide">
        <span>Summary</span>
        <strong>{insights.summary}</strong>
      </article>
      <InsightList title="Highlights" items={insights.highlights} />
      <InsightList title="Risks" items={insights.risks} />
      <InsightList title="Actions" items={insights.recommendations} />
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="insight-card">
      <span>{title}</span>
      <ul>
        {items.slice(0, 4).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function MemberBreakdown({ report }: { report: ReportRow }) {
  const byUser = report.structuredContent?.byUser ?? [];
  const memberInsights = new Map(
    (report.structuredContent?.insights?.memberInsights ?? []).map((item) => [item.name, item]),
  );

  if (byUser.length === 0) {
    return <div className="empty">No member performance evidence in this report</div>;
  }

  return (
    <div className="member-grid">
      {byUser.map((group) => {
        const completed = group.items.filter((item) => item.eventType === 'task_completed');
        const progress = group.items.filter((item) => item.eventType === 'task_progress');
        const blockers = group.items.filter((item) => item.eventType === 'blocker');
        const decisions = group.items.filter((item) => item.eventType === 'decision');
        const insight = memberInsights.get(group.name);

        return (
          <article className="member-card" key={group.name}>
            <div className="performance-head">
              <div>
                <strong>{group.name}</strong>
                {insight ? <span>{insight.signal}</span> : null}
              </div>
              <StatusBadge value={insight ? `score ${insight.score}` : `${group.items.length} items`} />
            </div>
            <div className="score-row">
              <span>Done <strong>{completed.length}</strong></span>
              <span>Progress <strong>{progress.length}</strong></span>
              <span>Blocker <strong>{blockers.length}</strong></span>
              <span>Decision <strong>{decisions.length}</strong></span>
            </div>
            <ul className="work-list">
              {group.items.slice(0, 6).map((item, index) => (
                <li key={index}>
                  <StatusBadge value={item.eventType.replace('task_', '')} />
                  <span>{item.summary}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

function Messages({ messages }: { messages: MessageRow[] }) {
  return (
    <Panel title="Messages" icon={MessageSquareText}>
      <DataTable
        columns={['Message', 'Sender', 'Group', 'Topic', 'Status', 'Sent']}
        rows={messages.map((message) => [
          <span className="truncate" key="text">{message.text ?? message.messageType}</span>,
          userLabel(message.sender, message.senderUsername),
          message.groupTitle ?? 'Unknown',
          message.topicName ?? 'General',
          <StatusBadge key="status" value={message.processingStatus} />,
          formatDate(message.sentAt),
        ])}
      />
    </Panel>
  );
}

function Jobs({
  jobs,
  onRunJob,
}: {
  jobs: JobRow[];
  onRunJob: (job: 'extract' | 'report' | 'retry-failed' | 'retention') => void;
}) {
  return (
    <section className="stack">
      <Panel title="Job Controls" icon={Play}>
        <div className="button-grid compact">
          <button type="button" onClick={() => onRunJob('extract')}>Run extraction</button>
          <button type="button" onClick={() => onRunJob('retry-failed')}>Retry failed</button>
          <button type="button" onClick={() => onRunJob('retention')}>Run retention</button>
        </div>
      </Panel>

      <Panel title="Job Batches" icon={Clock3}>
        <DataTable
          columns={['Type', 'Status', 'Period', 'Created', 'Completed', 'Error']}
          rows={jobs.map((job) => [
            job.jobType,
            <StatusBadge key="status" value={job.status} />,
            `${formatDate(job.periodStart)} - ${formatDate(job.periodEnd)}`,
            formatDate(job.createdAt),
            job.completedAt ? formatDate(job.completedAt) : 'pending',
            job.errorMessage ?? '',
          ])}
        />
      </Panel>
    </section>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Gauge;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <Icon size={18} />
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty">
                No records
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HealthRow({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="health-row">
      <span>{label}</span>
      <strong className={danger ? 'danger-text' : undefined}>{formatNumber(value)}</strong>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    ['done', 'sent', 'completed', 'active', 'watched', 'processed'].includes(normalized)
      ? 'good'
      : ['failed', 'blocked', 'inactive'].includes(normalized)
        ? 'bad'
        : ['processing', 'running', 'pending', 'open', 'in_progress'].includes(normalized)
          ? 'warn'
          : 'neutral';

  return <span className={`badge ${tone}`}>{value}</span>;
}

function filterData(data: DashboardData, query: string): DashboardData {
  if (!query.trim()) {
    return data;
  }

  const value = query.toLowerCase();
  const match = (record: unknown) => JSON.stringify(record).toLowerCase().includes(value);

  return {
    metrics: data.metrics,
    groups: data.groups.filter(match),
    topics: data.topics.filter(match),
    reports: data.reports.filter(match),
    messages: data.messages.filter(match),
    jobs: data.jobs.filter(match),
    aiRuns: data.aiRuns.filter(match),
    performance: data.performance,
  };
}

function userLabel(name: string | null, username: string | null) {
  if (name && username) {
    return `${name} (@${username})`;
  }
  return name ?? (username ? `@${username}` : 'Unassigned');
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

function reportRange(preset: 'today' | 'week' | 'full' | 'custom', customStart: string, customEnd: string) {
  if (preset === 'today') {
    return { start: startOfToday(), end: new Date() };
  }

  if (preset === 'week') {
    return { start: startOfWeek(), end: new Date() };
  }

  if (preset === 'full') {
    return { start: new Date('2000-01-01T00:00:00.000Z'), end: new Date() };
  }

  return {
    start: new Date(customStart),
    end: new Date(customEnd),
  };
}

function toDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
