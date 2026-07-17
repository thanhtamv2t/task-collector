import {
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import {
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileText,
  Layers3,
  LogOut,
  MessageSquareText,
  Play,
  RefreshCw,
  SearchIcon,
  Shield,
  Trash2,
  type LucideIcon,
  Users,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Metrics = {
  messages: {
    collected: number
    pending: number
    processing: number
    processed: number
    failed: number
  }
  ai: {
    runs: number
    failures: number
    inputTokens: number
    outputTokens: number
    estimatedCostUsd: number
  }
  tasks: { created: number; eventsCreated: number }
  reports: { sent: number; failed: number }
  jobs: { batches: number; failedBatches: number; averageDurationMs: number | null }
}

type GroupRow = {
  id: string
  title: string | null
  telegramChatId: string
  isActive: boolean
  timezone: string
  topicCount: number
  monitoredTopicCount: number
  messageCount: number
}

type TopicRow = {
  id: string
  groupTitle: string | null
  name: string | null
  telegramThreadId: string | null
  isMonitored: boolean
  messageCount: number
}

type ReportRow = {
  id: string
  reportType: string
  status: string
  groupTitle: string | null
  periodStart: string
  periodEnd: string
  telegramMessageId: string | null
  content: string | null
  structuredContent: StructuredReport | null
  sentAt: string | null
  createdAt: string
}

type StructuredReport = {
  insights?: ReportInsights
  completed?: ReportItem[]
  inProgress?: ReportItem[]
  blockers?: ReportItem[]
  decisions?: ReportItem[]
  needsReview?: ReportItem[]
  byUser?: Array<{ name: string; items: ReportItem[] }>
}

type ReportInsights = {
  summary: string
  highlights: string[]
  risks: string[]
  recommendations: string[]
  memberInsights: Array<{
    name: string
    score: number
    completed: number
    progress: number
    blockers: number
    decisions: number
    signal: string
  }>
  pmReview?: {
    executiveSummary: string
    teamHealth: 'strong' | 'steady' | 'at_risk' | 'critical'
    keyThemes: string[]
    risks: string[]
    recommendations: string[]
    memberAssessments: Array<{
      name: string
      rating: 'exceptional' | 'strong' | 'steady' | 'needs_attention' | 'insufficient_data'
      score: number
      assessment: string
      strengths: string[]
      concerns: string[]
      nextWeekFocus: string
      monthlyEvaluationNote: string
    }>
  }
}

type ReportItem = {
  eventType: string
  summary: string
  sourceMessageIds: number[]
  confidence: string | null
  createdAt: string
}

type MessageRow = {
  id: string
  telegramMessageId: string
  messageType: string
  text: string | null
  processingStatus: string
  groupTitle: string | null
  topicName: string | null
  sender: string | null
  senderUsername: string | null
  sentAt: string
}

type JobRow = {
  id: string
  jobType: string
  status: string
  periodStart: string
  periodEnd: string
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

type AiRunRow = {
  id: string
  runType: string
  model: string
  status: string
  groupTitle: string | null
  topicName: string | null
  inputTokens: number | null
  outputTokens: number | null
  estimatedCost: string | null
  errorMessage: string | null
  startedAt: string
}

type AuthUser = {
  id: number
  login: string
  name: string | null
  avatarUrl: string | null
  expiresAt: number
}

type PerformanceRow = {
  periodStart: string
  periodEnd: string
  memberName: string
  username: string | null
  telegramUserId: string | null
  totalItems: number
  completedItems: number
  progressItems: number
  blockerItems: number
  decisionItems: number
  lastActivityAt: string
  items: Array<{
    summary: string
    eventType: string
    sourceMessageIds: number[]
    occurredAt: string
  }>
}

type PerformanceResponse = {
  mode: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  rows: PerformanceRow[]
  members?: string[]
}

type DashboardData = {
  metrics: Metrics | null
  groups: GroupRow[]
  topics: TopicRow[]
  reports: ReportRow[]
  messages: MessageRow[]
  jobs: JobRow[]
  aiRuns: AiRunRow[]
  performance: PerformanceResponse | null
}

type CleanDerivedResult = {
  deletedReports: number
  deletedAiRuns: number
  deletedJobBatches: number
  deletedTaskEvents: number
  deletedTasks: number
  preservedMessages: boolean
}

type JobAction =
  | 'extract'
  | 'report'
  | 'retry-failed'
  | 'retention'
  | 'daily-report-reminder'

type PerformanceMode = 'day' | 'week' | 'month' | 'year'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

const initialData: DashboardData = {
  metrics: null,
  groups: [],
  topics: [],
  reports: [],
  messages: [],
  jobs: [],
  aiRuns: [],
  performance: null,
}

type DashboardContextValue = {
  data: DashboardData
  filtered: DashboardData
  user: AuthUser
  loading: boolean
  error: string | null
  query: string
  lastUpdated: string | null
  performanceMode: PerformanceMode
  performanceMember: string
  performanceFrom: string
  performanceTo: string
  generatingReport: boolean
  selectedReportId: string | null
  setQuery: (query: string) => void
  load: () => Promise<void>
  runJob: (job: JobAction) => Promise<void>
  generateReport: (input: {
    groupId: string
    periodStart: string
    periodEnd: string
    reportType: string
  }) => Promise<void>
  openReport: (reportId: string) => void
  openMaintenance: () => void
  setPerformanceMember: (member: string) => void
  setPerformanceDateRange: (from: string, to: string) => void
  setPerformanceMode: (mode: PerformanceMode) => void
  setPerformancePage: (page: number) => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { credentials: 'include' })

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }

  return response.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }

  return response.json() as Promise<T>
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`

  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown }
    const message = body.message ?? body.error
    if (Array.isArray(message)) {
      return `${fallback}: ${message.join(', ')}`
    }
    if (message) {
      return `${fallback}: ${String(message)}`
    }
  } catch {
    // Keep the status-only fallback when the response is not JSON.
  }

  return fallback
}

export function DashboardShell() {
  const navigate = useNavigate()
  const initialSearchParams = new URLSearchParams(window.location.search)
  const initialReportId = initialSearchParams.get('reportId')
  const initialAuthError = initialSearchParams.get('auth_error')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    initialReportId
  )
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialAuthError)
  const [query, setQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>('week')
  const [performanceMember, setPerformanceMember] = useState('all')
  const [performanceFrom, setPerformanceFrom] = useState('')
  const [performanceTo, setPerformanceTo] = useState('')
  const [performancePage, setPerformancePage] = useState(1)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportDrawerOpen, setReportDrawerOpen] = useState(Boolean(initialReportId))
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [cleaningDerived, setCleaningDerived] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const performanceUrl =
        `/internal/dashboard/performance?mode=${performanceMode}` +
        `&page=${performancePage}&pageSize=12` +
        (performanceMember !== 'all'
          ? `&memberName=${encodeURIComponent(performanceMember)}`
          : '') +
        (performanceFrom
          ? `&from=${encodeURIComponent(
              new Date(`${performanceFrom}T00:00:00`).toISOString()
            )}`
          : '') +
        (performanceTo
          ? `&to=${encodeURIComponent(
              new Date(`${performanceTo}T23:59:59`).toISOString()
            )}`
          : '')

      const [metrics, groups, topics, reports, messages, jobs, aiRuns, performance] =
        await Promise.all([
          getJson<Metrics>('/internal/metrics'),
          getJson<GroupRow[]>('/internal/dashboard/groups'),
          getJson<TopicRow[]>('/internal/dashboard/topics'),
          getJson<ReportRow[]>('/internal/dashboard/reports'),
          getJson<MessageRow[]>('/internal/dashboard/messages'),
          getJson<JobRow[]>('/internal/dashboard/jobs'),
          getJson<AiRunRow[]>('/internal/dashboard/ai-runs'),
          getJson<PerformanceResponse>(performanceUrl),
        ])

      setData({ metrics, groups, topics, reports, messages, jobs, aiRuns, performance })
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null)
      }
      setError(err instanceof Error ? err.message : 'Unable to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [
    performanceFrom,
    performanceMember,
    performanceMode,
    performancePage,
    performanceTo,
  ])

  const checkAuth = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const sessionUser = await getJson<AuthUser>('/auth/me')
      setUser(sessionUser)
      await load()
    } catch (err) {
      setUser(null)
      setError(
        err instanceof Error && !err.message.startsWith('401')
          ? err.message
          : initialAuthError
      )
      setLoading(false)
    }
  }, [initialAuthError, load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkAuth()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [checkAuth])

  const runJob = useCallback(async (job: JobAction) => {
    setLoading(true)
    setError(null)

    try {
      await postJson(`/internal/jobs/${job}`)
      toast.success(`Job queued: ${job}`)
      await load()
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null)
      }
      const message = err instanceof Error ? err.message : `Unable to trigger ${job}`
      setError(message)
      toast.error(message)
      setLoading(false)
    }
  }, [load])

  const generateReport = useCallback(async (input: {
    groupId: string
    periodStart: string
    periodEnd: string
    reportType: string
  }) => {
    setGeneratingReport(true)
    setError(null)

    try {
      const result = await postJson<{ reportId: string }>(
        '/internal/dashboard/reports/generate',
        input
      )
      setSelectedReportId(result.reportId)
      setReportDrawerOpen(true)
      void navigate({ to: '/reports' })
      toast.success('Report generated')
      await load()
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null)
      }
      const message = err instanceof Error ? err.message : 'Unable to generate report'
      setError(message)
      toast.error(message)
    } finally {
      setGeneratingReport(false)
    }
  }, [load, navigate])

  const cleanDerivedData = async () => {
    setCleaningDerived(true)
    setError(null)

    try {
      const result = await postJson<CleanDerivedResult>(
        '/internal/dashboard/cleanup-derived'
      )
      setMaintenanceOpen(false)
      setReportDrawerOpen(false)
      setSelectedReportId(null)
      toast.success(
        `Cleaned ${result.deletedReports} reports, ${result.deletedAiRuns} AI runs, ${result.deletedJobBatches} jobs`
      )
      await load()
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('401')) {
        setUser(null)
      }
      const message = err instanceof Error ? err.message : 'Unable to clean derived data'
      setError(message)
      toast.error(message)
    } finally {
      setCleaningDerived(false)
    }
  }

  const filtered = useMemo(() => filterData(data, query), [data, query])
  const selectedReport =
    data.reports.find((report) => report.id === selectedReportId) ?? null
  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      data,
      filtered,
      user: user as AuthUser,
      loading,
      error,
      query,
      lastUpdated,
      performanceMode,
      performanceMember,
      performanceFrom,
      performanceTo,
      generatingReport,
      selectedReportId,
      setQuery,
      load,
      runJob,
      generateReport,
      openReport: (reportId) => {
        setSelectedReportId(reportId)
        setReportDrawerOpen(true)
      },
      openMaintenance: () => setMaintenanceOpen(true),
      setPerformanceMember: (member) => {
        setPerformanceMember(member)
        setPerformancePage(1)
      },
      setPerformanceDateRange: (from, to) => {
        setPerformanceFrom(from)
        setPerformanceTo(to)
        setPerformancePage(1)
      },
      setPerformanceMode: (mode) => {
        setPerformanceMode(mode)
        setPerformancePage(1)
      },
      setPerformancePage,
    }),
    [
      data,
      error,
      filtered,
      generateReport,
      generatingReport,
      lastUpdated,
      load,
      loading,
      performanceFrom,
      performanceMember,
      performanceMode,
      performanceTo,
      query,
      runJob,
      selectedReportId,
      user,
    ]
  )

  if (user === undefined) {
    return <AuthScreen loading={loading} error={error} />
  }

  if (!user) {
    return <AuthScreen error={error} />
  }

  return (
    <>
      <Header>
        <div className='me-auto flex min-w-0 flex-col'>
          <h1 className='truncate text-lg font-semibold'>
            Telegram Performance Reporter
          </h1>
          <p className='hidden text-sm text-muted-foreground md:block'>
            Reports, member evidence, and collection health.
          </p>
        </div>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=''
                  className='size-6 rounded-md object-cover'
                />
              ) : (
                <Shield className='size-4' />
              )}
              <span className='font-medium text-foreground'>
                {user.name ?? user.login}
              </span>
              <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Not loaded yet'}</span>
            </div>
          </div>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <div className='relative'>
              <SearchIcon className='absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Filter dashboard'
                className='ps-9 sm:w-64'
              />
            </div>
            <Button variant='outline' onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
              Refresh
            </Button>
            <Button variant='outline' asChild>
              <a href={`${apiBase}/auth/logout`}>
                <LogOut className='size-4' />
                Logout
              </a>
            </Button>
          </div>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <DashboardContext.Provider value={contextValue}>
          <Outlet />
        </DashboardContext.Provider>
      </Main>

      <ReportSheet
        report={selectedReport}
        open={reportDrawerOpen}
        onOpenChange={setReportDrawerOpen}
      />
      <MaintenanceSheet
        open={maintenanceOpen}
        cleaning={cleaningDerived}
        onOpenChange={setMaintenanceOpen}
        onClean={cleanDerivedData}
      />
    </>
  )
}

function useDashboard() {
  const context = useContext(DashboardContext)

  if (!context) {
    throw new Error('useDashboard must be used within DashboardShell')
  }

  return context
}

export function DashboardOverview() {
  const { data, runJob, openMaintenance } = useDashboard()

  return (
    <OverviewTab
      data={data}
      metrics={data.metrics}
      onRunJob={runJob}
      onOpenMaintenance={openMaintenance}
    />
  )
}

export function DashboardPerformance() {
  const {
    data,
    performanceMode,
    performanceMember,
    performanceFrom,
    performanceTo,
    setPerformanceMember,
    setPerformanceDateRange,
    setPerformanceMode,
    setPerformancePage,
  } = useDashboard()

  return (
    <PerformanceTab
      performance={data.performance}
      mode={performanceMode}
      member={performanceMember}
      from={performanceFrom}
      to={performanceTo}
      members={data.performance?.members ?? []}
      onMemberChange={setPerformanceMember}
      onDateChange={setPerformanceDateRange}
      onModeChange={setPerformanceMode}
      onPageChange={setPerformancePage}
    />
  )
}

export function DashboardReports() {
  const {
    data,
    filtered,
    selectedReportId,
    generatingReport,
    generateReport,
    openReport,
  } = useDashboard()

  return (
    <ReportsTab
      groups={data.groups}
      reports={filtered.reports}
      selectedReportId={selectedReportId}
      generating={generatingReport}
      onGenerate={generateReport}
      onSelectReport={openReport}
    />
  )
}

export function DashboardGroups() {
  const { filtered } = useDashboard()

  return <GroupsTab groups={filtered.groups} topics={filtered.topics} />
}

export function DashboardMessages() {
  const { filtered } = useDashboard()

  return <MessagesTab messages={filtered.messages} />
}

export function DashboardJobs() {
  const { filtered, runJob } = useDashboard()

  return <JobsTab jobs={filtered.jobs} aiRuns={filtered.aiRuns} onRunJob={runJob} />
}

function AuthScreen({ loading = false, error }: { loading?: boolean; error?: string | null }) {
  return (
    <Main className='flex min-h-[calc(100svh-4rem)] items-center justify-center'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <div className='mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground'>
            <Shield className='size-5' />
          </div>
          <CardTitle>Performance Reporter Admin</CardTitle>
          <CardDescription>
            Sign in with the GitHub account configured as dashboard admin.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Button className='w-full' asChild>
            <a href={`${apiBase}/auth/github`}>
              <Shield className='size-4' />
              {loading ? 'Checking session' : 'Continue with GitHub'}
            </a>
          </Button>
          {error ? <ErrorBanner message={error} compact /> : null}
        </CardContent>
      </Card>
    </Main>
  )
}

function OverviewTab({
  data,
  metrics,
  onRunJob,
  onOpenMaintenance,
}: {
  data: DashboardData
  metrics: Metrics | null
  onRunJob: (job: JobAction) => void
  onOpenMaintenance: () => void
}) {
  const completedItems =
    data.performance?.rows.reduce((sum, row) => sum + row.completedItems, 0) ?? 0

  return (
    <>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          title='Messages collected'
          value={metrics?.messages.collected ?? 0}
          icon={MessageSquareText}
        />
        <MetricCard title='Completed items' value={completedItems} icon={CheckCircle2} />
        <MetricCard title='Reports created' value={data.reports.length} icon={FileText} />
        <MetricCard title='AI evaluations' value={metrics?.ai.runs ?? 0} icon={BrainCircuit} />
      </div>

      <div className='grid gap-4 lg:grid-cols-7'>
        <Card className='lg:col-span-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Database className='size-4' />
              Runtime Snapshot
            </CardTitle>
            <CardDescription>Collection, processing, and report health.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-3 sm:grid-cols-2'>
              <HealthRow label='Pending messages' value={metrics?.messages.pending ?? 0} />
              <HealthRow
                label='Processing messages'
                value={metrics?.messages.processing ?? 0}
              />
              <HealthRow
                label='Processed messages'
                value={metrics?.messages.processed ?? 0}
              />
              <HealthRow
                label='Failed messages'
                value={metrics?.messages.failed ?? 0}
                danger={(metrics?.messages.failed ?? 0) > 0}
              />
              <HealthRow
                label='Failed AI runs'
                value={metrics?.ai.failures ?? 0}
                danger={(metrics?.ai.failures ?? 0) > 0}
              />
              <HealthRow
                label='Failed reports'
                value={metrics?.reports.failed ?? 0}
                danger={(metrics?.reports.failed ?? 0) > 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Play className='size-4' />
              Manual Controls
            </CardTitle>
            <CardDescription>Queue maintenance and reporting jobs.</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-2 sm:grid-cols-2 lg:grid-cols-1'>
            <Button variant='outline' onClick={() => onRunJob('extract')}>
              Run extraction
            </Button>
            <Button variant='outline' onClick={() => onRunJob('retry-failed')}>
              Retry failed
            </Button>
            <Button variant='outline' onClick={() => onRunJob('retention')}>
              Run retention
            </Button>
            <Button variant='outline' onClick={() => onRunJob('daily-report-reminder')}>
              Check missing reports
            </Button>
            <Button variant='destructive' onClick={onOpenMaintenance}>
              <Trash2 className='size-4' />
              Clean derived data
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CalendarDays className='size-4' />
            Recent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </>
  )
}

function PerformanceTab({
  performance,
  mode,
  member,
  from,
  to,
  members,
  onMemberChange,
  onDateChange,
  onModeChange,
  onPageChange,
}: {
  performance: PerformanceResponse | null
  mode: PerformanceMode
  member: string
  from: string
  to: string
  members: string[]
  onMemberChange: (member: string) => void
  onDateChange: (from: string, to: string) => void
  onModeChange: (mode: PerformanceMode) => void
  onPageChange: (page: number) => void
}) {
  const rows = performance?.rows ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <CalendarDays className='size-4' />
          Performance Calendar
        </CardTitle>
        <CardDescription>Review member activity and source evidence.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end'>
          <div className='grid gap-3 sm:grid-cols-3'>
            <Field label='Member'>
              <select
                value={member}
                onChange={(event) => onMemberChange(event.target.value)}
                className='h-9 rounded-md border bg-background px-3 text-sm'
              >
                <option value='all'>All members</option>
                {members.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label='From'>
              <Input
                type='date'
                value={from}
                onChange={(event) => onDateChange(event.target.value, to)}
              />
            </Field>
            <Field label='To'>
              <Input
                type='date'
                value={to}
                onChange={(event) => onDateChange(from, event.target.value)}
              />
            </Field>
          </div>
          <div className='flex rounded-md border p-1'>
            {(['day', 'week', 'month', 'year'] as const).map((option) => (
              <Button
                key={option}
                type='button'
                variant={mode === option ? 'default' : 'ghost'}
                size='sm'
                onClick={() => onModeChange(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <div className='flex items-center justify-between gap-2 lg:justify-end'>
            <Button
              variant='outline'
              size='sm'
              disabled={!performance || performance.page <= 1}
              onClick={() => onPageChange((performance?.page ?? 1) - 1)}
            >
              Prev
            </Button>
            <span className='text-sm text-muted-foreground'>
              Page {performance?.page ?? 1}/{performance?.totalPages ?? 1}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={!performance || performance.page >= performance.totalPages}
              onClick={() => onPageChange((performance?.page ?? 1) + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState>No performance data</EmptyState>
        ) : (
          <div className='grid gap-4 xl:grid-cols-2'>
            {rows.map((row) => (
              <Card
                key={`${row.periodStart}-${row.telegramUserId ?? row.memberName}`}
                className='gap-4 shadow-none'
              >
                <CardHeader>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <CardTitle className='truncate text-base'>
                        {userLabel(row.memberName, row.username)}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(row.periodStart)} - {formatDate(row.periodEnd)}
                      </CardDescription>
                    </div>
                    <StatusBadge value={`${row.totalItems} items`} />
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid grid-cols-4 gap-2 text-sm'>
                    <Score label='Done' value={row.completedItems} />
                    <Score label='Progress' value={row.progressItems} />
                    <Score label='Blocker' value={row.blockerItems} />
                    <Score label='Decision' value={row.decisionItems} />
                  </div>
                  <ul className='space-y-2'>
                    {row.items.slice(0, 5).map((item, index) => (
                      <li key={index} className='flex gap-2 text-sm'>
                        <StatusBadge value={item.eventType.replace('task_', '')} />
                        <span className='min-w-0 flex-1 text-muted-foreground'>
                          {item.summary}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReportsTab({
  groups,
  reports,
  selectedReportId,
  generating,
  onGenerate,
  onSelectReport,
}: {
  groups: GroupRow[]
  reports: ReportRow[]
  selectedReportId: string | null
  generating: boolean
  onGenerate: (input: {
    groupId: string
    periodStart: string
    periodEnd: string
    reportType: string
  }) => void
  onSelectReport: (reportId: string) => void
}) {
  const defaultGroupId = groups[0]?.id ?? ''
  const [groupId, setGroupId] = useState(defaultGroupId)
  const [preset, setPreset] = useState<'today' | 'week' | 'full' | 'custom'>('week')
  const [customStart, setCustomStart] = useState(toDatetimeLocal(startOfWeek()))
  const [customEnd, setCustomEnd] = useState(toDatetimeLocal(new Date()))
  const range = reportRange(preset, customStart, customEnd)
  const activeGroupId = groupId || defaultGroupId

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Play className='size-4' />
            Create Performance Report
          </CardTitle>
          <CardDescription>
            {formatDateTime(range.start.toISOString())} -{' '}
            {formatDateTime(range.end.toISOString())}
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-3 lg:grid-cols-[1fr_180px_1fr_auto] lg:items-end'>
          <Field label='Group'>
            <select
              value={activeGroupId}
              onChange={(event) => setGroupId(event.target.value)}
              className='h-9 rounded-md border bg-background px-3 text-sm'
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title ?? group.telegramChatId}
                </option>
              ))}
            </select>
          </Field>
          <Field label='Range'>
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as typeof preset)}
              className='h-9 rounded-md border bg-background px-3 text-sm'
            >
              <option value='today'>Today</option>
              <option value='week'>Week to date</option>
              <option value='full'>Full history to now</option>
              <option value='custom'>Custom</option>
            </select>
          </Field>
          {preset === 'custom' ? (
            <div className='grid gap-3 sm:grid-cols-2'>
              <Field label='Start'>
                <Input
                  type='datetime-local'
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
              </Field>
              <Field label='End'>
                <Input
                  type='datetime-local'
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div />
          )}
          <Button
            disabled={!activeGroupId || generating}
            onClick={() =>
              onGenerate({
                groupId: activeGroupId,
                periodStart: range.start.toISOString(),
                periodEnd: range.end.toISOString(),
                reportType:
                  preset === 'week'
                    ? 'weekly_performance'
                    : 'daily_performance',
              })
            }
          >
            {generating ? 'Generating' : 'Generate report'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='size-4' />
            Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={['Type', 'Status', 'Group', 'Period', 'Created', 'Open']}
            rows={reports.map((report) => [
              report.reportType,
              <StatusBadge key='status' value={report.status} />,
              report.groupTitle ?? 'Unknown',
              `${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
              formatDate(report.createdAt),
              <Button
                key='open'
                type='button'
                variant={selectedReportId === report.id ? 'default' : 'outline'}
                size='sm'
                onClick={() => onSelectReport(report.id)}
              >
                View
              </Button>,
            ])}
          />
        </CardContent>
      </Card>
    </>
  )
}

function GroupsTab({ groups, topics }: { groups: GroupRow[]; topics: TopicRow[] }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='size-4' />
            Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={['Group', 'Chat ID', 'Timezone', 'Topics', 'Messages', 'Status']}
            rows={groups.map((group) => [
              group.title ?? 'Untitled group',
              group.telegramChatId,
              group.timezone,
              `${group.monitoredTopicCount}/${group.topicCount}`,
              formatNumber(group.messageCount),
              <StatusBadge key='active' value={group.isActive ? 'active' : 'inactive'} />,
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Layers3 className='size-4' />
            Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={['Topic', 'Group', 'Thread', 'Messages', 'Watch']}
            rows={topics.map((topic) => [
              topic.name ?? 'General',
              topic.groupTitle ?? 'Unknown',
              topic.telegramThreadId ?? 'none',
              formatNumber(topic.messageCount),
              <StatusBadge key='watch' value={topic.isMonitored ? 'watched' : 'off'} />,
            ])}
          />
        </CardContent>
      </Card>
    </>
  )
}

function MessagesTab({ messages }: { messages: MessageRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <MessageSquareText className='size-4' />
          Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={['Message', 'Sender', 'Group', 'Topic', 'Status', 'Sent']}
          rows={messages.map((message) => [
            <span key='text' className='block max-w-[36rem] truncate'>
              {message.text ?? message.messageType}
            </span>,
            userLabel(message.sender, message.senderUsername),
            message.groupTitle ?? 'Unknown',
            message.topicName ?? 'General',
            <StatusBadge key='status' value={message.processingStatus} />,
            formatDate(message.sentAt),
          ])}
        />
      </CardContent>
    </Card>
  )
}

function JobsTab({
  jobs,
  aiRuns,
  onRunJob,
}: {
  jobs: JobRow[]
  aiRuns: AiRunRow[]
  onRunJob: (job: JobAction) => void
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Play className='size-4' />
            Job Controls
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
          <Button variant='outline' onClick={() => onRunJob('extract')}>
            Run extraction
          </Button>
          <Button variant='outline' onClick={() => onRunJob('retry-failed')}>
            Retry failed
          </Button>
          <Button variant='outline' onClick={() => onRunJob('retention')}>
            Run retention
          </Button>
          <Button variant='outline' onClick={() => onRunJob('daily-report-reminder')}>
            Check missing reports
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Clock3 className='size-4' />
            Job Batches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={['Type', 'Status', 'Period', 'Created', 'Completed', 'Error']}
            rows={jobs.map((job) => [
              job.jobType,
              <StatusBadge key='status' value={job.status} />,
              `${formatDate(job.periodStart)} - ${formatDate(job.periodEnd)}`,
              formatDate(job.createdAt),
              job.completedAt ? formatDate(job.completedAt) : 'pending',
              job.errorMessage ?? '',
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BrainCircuit className='size-4' />
            AI Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={['Type', 'Model', 'Status', 'Scope', 'Tokens', 'Cost', 'Started']}
            rows={aiRuns.map((run) => [
              run.runType,
              run.model,
              <StatusBadge key='status' value={run.status} />,
              [run.groupTitle, run.topicName].filter(Boolean).join(' / ') || 'Global',
              `${run.inputTokens ?? 0} in / ${run.outputTokens ?? 0} out`,
              run.estimatedCost ?? '',
              formatDate(run.startedAt),
            ])}
          />
        </CardContent>
      </Card>
    </>
  )
}

function ReportSheet({
  report,
  open,
  onOpenChange,
}: {
  report: ReportRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-3xl'>
        <SheetHeader>
          <SheetTitle>Report detail</SheetTitle>
          <SheetDescription>
            Performance evidence, AI insights, and member activity.
          </SheetDescription>
        </SheetHeader>
        {report ? (
          <div className='space-y-4 px-4 pb-6'>
            <div className='flex items-start justify-between gap-3 rounded-md border p-4'>
              <div>
                <div className='font-medium'>{report.groupTitle ?? 'Unknown group'}</div>
                <div className='text-sm text-muted-foreground'>
                  {formatDateTime(report.periodStart)} - {formatDateTime(report.periodEnd)}
                </div>
              </div>
              <StatusBadge value={report.status} />
            </div>
            <ReportInsightsPanel report={report} />
            <MemberBreakdown report={report} />
            {report.content ? (
              <details className='group rounded-md border bg-muted/20'>
                <summary className='cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden'>
                  <span className='flex items-center justify-between gap-3'>
                    <span>Source report (Markdown)</span>
                    <span className='text-xs text-muted-foreground group-open:hidden'>Show</span>
                    <span className='hidden text-xs text-muted-foreground group-open:inline'>Hide</span>
                  </span>
                </summary>
                <article className='prose prose-sm max-w-none border-t p-4 dark:prose-invert'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {normalizeTelegramMarkdown(report.content)}
                  </ReactMarkdown>
                </article>
              </details>
            ) : null}
          </div>
        ) : (
          <div className='px-4'>
            <EmptyState>No report selected</EmptyState>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MaintenanceSheet({
  open,
  cleaning,
  onOpenChange,
  onClean,
}: {
  open: boolean
  cleaning: boolean
  onOpenChange: (open: boolean) => void
  onClean: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Maintenance</SheetTitle>
          <SheetDescription>
            Remove generated data while keeping collected Telegram messages.
          </SheetDescription>
        </SheetHeader>
        <div className='space-y-4 px-4'>
          <div className='flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive'>
            <Trash2 className='size-5' />
          </div>
          <div className='space-y-2'>
            <h3 className='font-semibold'>Clean derived data</h3>
            <p className='text-sm text-muted-foreground'>
              Deletes generated reports, AI runs, job batches, task events, and old
              task rows. Telegram messages, groups, topics, and users are preserved.
            </p>
          </div>
          <div className='flex justify-end gap-2'>
            <Button variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant='destructive' disabled={cleaning} onClick={onClean}>
              {cleaning ? 'Cleaning' : 'Clean derived data'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReportInsightsPanel({ report }: { report: ReportRow }) {
  const insights = report.structuredContent?.insights

  if (!insights) {
    return null
  }

  const totals = insights.memberInsights.reduce(
    (acc, member) => ({
      completed: acc.completed + member.completed,
      progress: acc.progress + member.progress,
      blockers: acc.blockers + member.blockers,
      decisions: acc.decisions + member.decisions,
    }),
    { completed: 0, progress: 0, blockers: 0, decisions: 0 }
  )
  const pmReview = insights.pmReview

  return (
    <div className='space-y-3'>
      {pmReview ? <PmReviewPanel review={pmReview} /> : null}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <InsightMetric label='Completed' value={totals.completed} tone='success' />
        <InsightMetric label='In progress' value={totals.progress} tone='info' />
        <InsightMetric label='Blockers' value={totals.blockers} tone='destructive' />
        <InsightMetric label='Decisions' value={totals.decisions} tone='warning' />
      </div>
      <div className='grid gap-3 lg:grid-cols-3'>
      <Card className='gap-3 shadow-none lg:col-span-3'>
        <CardHeader>
          <CardTitle className='text-base'>Summary</CardTitle>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {insights.summary}
        </CardContent>
      </Card>
      <InsightList title='Highlights' items={insights.highlights} />
      <InsightList title='Risks' items={insights.risks} />
      <InsightList title='Actions' items={insights.recommendations} />
      </div>
    </div>
  )
}

function PmReviewPanel({ review }: { review: NonNullable<ReportInsights['pmReview']> }) {
  const healthLabel = {
    strong: 'Strong',
    steady: 'Steady',
    at_risk: 'At risk',
    critical: 'Critical',
  }[review.teamHealth]
  const healthVariant = review.teamHealth === 'strong' ? 'success' : review.teamHealth === 'steady' ? 'info' : 'warning'

  return (
    <Card className='border-primary/20 shadow-none'>
      <CardHeader>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <CardTitle className='text-base'>PM weekly review</CardTitle>
            <CardDescription>Đánh giá tuần để tích lũy tín hiệu cho review hàng tháng</CardDescription>
          </div>
          <StatusBadge value={healthLabel} variant={healthVariant} />
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-sm leading-6'>{review.executiveSummary}</p>
        <div className='grid gap-3 md:grid-cols-3'>
          <InsightList title='Key themes' items={review.keyThemes} />
          <InsightList title='PM risks' items={review.risks} />
          <InsightList title='Next actions' items={review.recommendations} />
        </div>
        <div className='grid gap-3 lg:grid-cols-2'>
          {review.memberAssessments.map((member) => (
            <Card key={member.name} className='gap-3 bg-muted/20 shadow-none'>
              <CardHeader className='pb-1'>
                <div className='flex items-center justify-between gap-2'>
                  <CardTitle className='text-sm'>{member.name}</CardTitle>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-semibold'>{member.score}/100</span>
                    <StatusBadge value={member.rating.replace('_', ' ')} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                <p>{member.assessment}</p>
                <p className='text-muted-foreground'><span className='font-medium text-foreground'>Focus:</span> {member.nextWeekFocus}</p>
                <p className='text-muted-foreground'><span className='font-medium text-foreground'>Monthly signal:</span> {member.monthlyEvaluationNote}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InsightMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'info' | 'destructive' | 'warning'
}) {
  const color = {
    success: 'text-emerald-700 dark:text-emerald-300',
    info: 'text-sky-700 dark:text-sky-300',
    destructive: 'text-destructive',
    warning: 'text-amber-700 dark:text-amber-300',
  }[tone]

  return (
    <Card className='gap-1 py-3 shadow-none'>
      <CardContent className='px-4'>
        <div className='text-xs text-muted-foreground'>{label}</div>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className='gap-3 shadow-none'>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className='space-y-2 text-sm text-muted-foreground'>
          {items.slice(0, 4).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function MemberBreakdown({ report }: { report: ReportRow }) {
  const byUser = report.structuredContent?.byUser ?? []
  const memberInsights = new Map(
    (report.structuredContent?.insights?.memberInsights ?? []).map((item) => [
      item.name,
      item,
    ])
  )

  if (byUser.length === 0) {
    return <EmptyState>No member performance evidence in this report</EmptyState>
  }

  return (
    <div className='grid gap-3 xl:grid-cols-2'>
      {byUser.map((group) => {
        const completed = group.items.filter((item) => item.eventType === 'task_completed')
        const progress = group.items.filter((item) => item.eventType === 'task_progress')
        const blockers = group.items.filter((item) => item.eventType === 'blocker')
        const decisions = group.items.filter((item) => item.eventType === 'decision')
        const insight = memberInsights.get(group.name)

        return (
          <Card key={group.name} className='gap-4 shadow-none'>
            <CardHeader>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <CardTitle className='truncate text-base'>{group.name}</CardTitle>
                  {insight ? (
                    <CardDescription>{insight.signal}</CardDescription>
                  ) : null}
                </div>
                <StatusBadge
                  value={insight ? `score ${insight.score}` : `${group.items.length} items`}
                />
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-4 gap-2 text-sm'>
                <Score label='Done' value={completed.length} />
                <Score label='Progress' value={progress.length} />
                <Score label='Blocker' value={blockers.length} />
                <Score label='Decision' value={decisions.length} />
              </div>
              <ul className='space-y-2'>
                {group.items.slice(0, 6).map((item, index) => (
                  <li key={index} className='flex gap-2 text-sm'>
                    <StatusBadge
                      value={item.eventType.replace('task_', '')}
                      className='mt-0.5 h-6 self-start px-2 text-[11px] leading-4'
                    />
                    <span className='min-w-0 flex-1 text-muted-foreground'>
                      {item.summary}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='size-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{formatNumber(value)}</div>
      </CardContent>
    </Card>
  )
}

function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length}>
              <EmptyState>No records</EmptyState>
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>{cell}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function HealthRow({
  label,
  value,
  danger = false,
}: {
  label: string
  value: number
  danger?: boolean
}) {
  return (
    <div className='flex items-center justify-between rounded-md border px-3 py-2'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span className={danger ? 'font-semibold text-destructive' : 'font-semibold'}>
        {formatNumber(value)}
      </span>
    </div>
  )
}

function StatusBadge({
  value,
  className,
  variant: forcedVariant,
}: {
  value: string
  className?: string
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline'
}) {
  const normalized = value.toLowerCase()
  const variant = forcedVariant ?? (
    ['done', 'sent', 'completed', 'active', 'watched', 'processed'].includes(
      normalized
    )
      ? 'success'
      : ['failed', 'blocked', 'inactive'].includes(normalized)
        ? 'destructive'
        : normalized.includes('pending') ||
            normalized.includes('processing') ||
            normalized.includes('running')
          ? 'warning'
          : normalized.includes('progress') || normalized.includes('decision')
            ? 'info'
            : 'secondary')

  return <Badge variant={variant} className={`shrink-0 self-start ${className ?? ''}`}>
    {value}
  </Badge>
}

function normalizeTelegramMarkdown(value: string) {
  return value
    .replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1')
    .replace(/^\*Performance report:\* (.+)$/gm, '# Performance report: $1')
    .replace(/^\*([^*\n]+)\*$/gm, '## $1')
    .replace(/^_([^_\n]+)_$/gm, '### $1')
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className='grid gap-1.5 text-sm font-medium'>
      <span>{label}</span>
      {children}
    </label>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-md border p-2'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='font-semibold'>{value}</div>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
      {children}
    </div>
  )
}

function ErrorBanner({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? 'flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive'
          : 'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive'
      }
    >
      <CircleAlert className='size-4' />
      <span>{message}</span>
    </div>
  )
}

function filterData(data: DashboardData, query: string): DashboardData {
  if (!query.trim()) {
    return data
  }

  const value = query.toLowerCase()
  const match = (record: unknown) => JSON.stringify(record).toLowerCase().includes(value)

  return {
    metrics: data.metrics,
    groups: data.groups.filter(match),
    topics: data.topics.filter(match),
    reports: data.reports.filter(match),
    messages: data.messages.filter(match),
    jobs: data.jobs.filter(match),
    aiRuns: data.aiRuns.filter(match),
    performance: data.performance,
  }
}

function userLabel(name: string | null, username: string | null) {
  if (name && username) {
    return `${name} (@${username})`
  }
  return name ?? (username ? `@${username}` : 'Unassigned')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfWeek() {
  const date = startOfToday()
  const day = date.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - daysSinceMonday)
  return date
}

function reportRange(
  preset: 'today' | 'week' | 'full' | 'custom',
  customStart: string,
  customEnd: string
) {
  if (preset === 'today') {
    return { start: startOfToday(), end: new Date() }
  }

  if (preset === 'week') {
    return { start: startOfWeek(), end: new Date() }
  }

  if (preset === 'full') {
    return { start: new Date('2000-01-01T00:00:00.000Z'), end: new Date() }
  }

  return {
    start: new Date(customStart),
    end: new Date(customEnd),
  }
}

function toDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}
