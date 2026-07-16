import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ReportsModule } from '../reports/reports.module';
import { TasksModule } from '../tasks/tasks.module';
import { TelegramBotModule } from '../telegram/telegram-bot.module';
import { ExtractionJob } from './extraction.job';
import { JobPayloadService } from './job-payload.service';
import { JobSchedulerService } from './job-scheduler.service';
import { JobTriggerService } from './job-trigger.service';
import { JobWorkerService } from './job-worker.service';
import { JobsRepository } from './jobs.repository';
import { PgBossService } from './pg-boss.service';
import { ReportJob } from './report.job';
import { RetryFailedJob } from './retry-failed.job';
import { RetentionJob } from './retention.job';
import { AlertService } from './alert.service';
import { DailyReportReminderJob } from './daily-report-reminder.job';

@Module({
  imports: [AiModule, TasksModule, ReportsModule, TelegramBotModule],
  providers: [
    PgBossService,
    JobsRepository,
    JobPayloadService,
    JobTriggerService,
    ExtractionJob,
    ReportJob,
    RetryFailedJob,
    RetentionJob,
    AlertService,
    DailyReportReminderJob,
    JobWorkerService,
    JobSchedulerService,
  ],
  exports: [PgBossService, JobTriggerService, DailyReportReminderJob],
})
export class JobsModule {}
