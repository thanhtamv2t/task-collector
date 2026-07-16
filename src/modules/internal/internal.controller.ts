import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { assertInternalAuthorized } from '../auth/dashboard-auth';
import { JOB_QUEUE_NAMES } from '../jobs/jobs.constants';
import { JobTriggerService } from '../jobs/job-trigger.service';
import { PeriodInput } from '../jobs/jobs.types';
import { PgBossService } from '../jobs/pg-boss.service';
import { InternalDashboardService } from './internal-dashboard.service';
import { InternalGroupsService } from './internal-groups.service';
import { InternalMetricsService } from './internal-metrics.service';
import { ReportsService } from '../reports/reports.service';
import { DailyReportReminderJob } from '../jobs/daily-report-reminder.job';

@Controller('internal/jobs')
export class InternalJobsController {
  constructor(
    private readonly triggers: JobTriggerService,
    private readonly pgBoss: PgBossService,
    private readonly dailyReportReminderJob: DailyReportReminderJob,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Post('extract')
  async triggerExtraction(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Body() body: PeriodInput,
  ) {
    this.assertAuthorized(token, cookie);
    return this.runTrigger(() => this.triggers.triggerExtraction(body ?? {}));
  }

  @Post('report')
  async triggerReport(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Body() body: PeriodInput,
  ) {
    this.assertAuthorized(token, cookie);
    return this.runTrigger(() => this.triggers.triggerReport(body ?? {}));
  }

  @Post('retry-failed')
  async triggerRetryFailed(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
  ) {
    this.assertAuthorized(token, cookie);
    return this.triggers.triggerRetryFailed();
  }

  @Post('retention')
  async triggerRetention(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
  ) {
    this.assertAuthorized(token, cookie);
    return this.triggers.triggerRetention();
  }

  @Post('daily-report-reminder')
  async triggerDailyReportReminder(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
  ) {
    this.assertAuthorized(token, cookie);
    return this.dailyReportReminderJob.handle();
  }

  @Get(':id')
  async getJob(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
  ) {
    this.assertAuthorized(token, cookie);

    for (const queue of this.knownQueues()) {
      const job = await this.pgBoss.client.getJobById(queue, id, { includeArchive: true });
      if (job) {
        return {
          queue,
          job,
        };
      }
    }

    throw new NotFoundException(`Job ${id} was not found`);
  }

  private assertAuthorized(token: string | undefined, cookie: string | undefined): void {
    assertInternalAuthorized(this.app, token, cookie);
  }

  private async runTrigger<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid job trigger request';
      throw new BadRequestException(message);
    }
  }

  private knownQueues(): string[] {
    const schedules = (process.env.REPORT_SCHEDULES ?? '')
      .split(',')
      .map((schedule) => schedule.trim())
      .filter(Boolean);

    return [
      JOB_QUEUE_NAMES.extraction,
      JOB_QUEUE_NAMES.report,
      JOB_QUEUE_NAMES.retryFailed,
      ...schedules.map((_, index) => `${JOB_QUEUE_NAMES.extraction}.schedule.${index}`),
      ...schedules.map((_, index) => `${JOB_QUEUE_NAMES.report}.schedule.${index}`),
    ];
  }
}

@Controller('internal/groups')
export class InternalGroupsController {
  constructor(
    private readonly triggers: JobTriggerService,
    private readonly groups: InternalGroupsService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Post(':id/reprocess')
  async reprocessGroup(
    @Headers('x-admin-token') token: string | undefined,
    @Param('id') groupId: string,
    @Body() body: PeriodInput,
    @Headers('cookie') cookie?: string,
  ) {
    this.assertAuthorized(token, cookie);
    return this.runTrigger(() =>
      this.triggers.triggerExtraction({
        ...(body ?? {}),
        groupId,
      }),
    );
  }

  @Delete(':id/data')
  async deleteGroupData(
    @Headers('x-admin-token') token: string | undefined,
    @Param('id') groupId: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.assertAuthorized(token, cookie);
    const result = await this.groups.deleteGroupData(groupId);

    if (!result.deletedGroup) {
      throw new NotFoundException(`Group ${groupId} was not found`);
    }

    return result;
  }

  private assertAuthorized(token: string | undefined, cookie: string | undefined): void {
    assertInternalAuthorized(this.app, token, cookie);
  }

  private async runTrigger<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid group reprocess request';
      throw new BadRequestException(message);
    }
  }
}

@Controller('internal/metrics')
export class InternalMetricsController {
  constructor(
    private readonly metrics: InternalMetricsService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Get()
  async snapshot(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.assertAuthorized(token, cookie);
    return this.metrics.snapshot();
  }

  private assertAuthorized(token: string | undefined, cookie: string | undefined): void {
    assertInternalAuthorized(this.app, token, cookie);
  }
}

@Controller('internal/dashboard')
export class InternalDashboardController {
  constructor(
    private readonly dashboard: InternalDashboardService,
    private readonly reportsService: ReportsService,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Get('groups')
  async groups(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.groups();
  }

  @Get('topics')
  async topics(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.topics();
  }

  @Get('tasks')
  async tasks(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.tasks();
  }

  @Get('reports')
  async reports(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.reports();
  }

  @Post('reports/generate')
  async generateReport(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Body()
    body: {
      groupId?: string;
      periodStart?: string;
      periodEnd?: string;
      reportType?: string;
      notifyAdmins?: boolean;
    },
  ) {
    this.assertAuthorized(token, cookie);

    if (!body.groupId) {
      throw new BadRequestException('groupId is required');
    }

    const periodStart = body.periodStart ? new Date(body.periodStart) : null;
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : new Date();

    if (!periodStart || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Valid periodStart and periodEnd are required');
    }

    const group = await this.dashboard.groupById(body.groupId);
    if (!group) {
      throw new NotFoundException(`Group ${body.groupId} was not found`);
    }

    return this.reportsService.generateGroupReport({
      groupId: group.id,
      title: group.title ?? group.id,
      periodStart,
      periodEnd,
      reportType: body.reportType ?? 'dashboard_performance',
      telegramChatId: null,
      telegramThreadId: null,
      notifyAdmins: body.notifyAdmins !== false,
    });
  }

  @Post('cleanup-derived')
  async cleanupDerivedData(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
  ) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.cleanDerivedData();
  }

  @Get('messages')
  async messages(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.messages();
  }

  @Get('jobs')
  async jobs(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.jobs();
  }

  @Get('ai-runs')
  async aiRuns(@Headers('x-admin-token') token: string | undefined, @Headers('cookie') cookie?: string) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.aiRuns();
  }

  @Get('performance')
  async performance(
    @Headers('x-admin-token') token: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Query('mode') mode = 'week',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
    @Query('memberName') memberName?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertAuthorized(token, cookie);
    return this.dashboard.performance({
      mode,
      page: Number(page),
      pageSize: Number(pageSize),
      memberName,
      from,
      to,
    });
  }

  private assertAuthorized(token: string | undefined, cookie: string | undefined): void {
    assertInternalAuthorized(this.app, token, cookie);
  }
}
