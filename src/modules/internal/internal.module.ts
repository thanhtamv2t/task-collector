import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { InternalDashboardService } from './internal-dashboard.service';
import { InternalGroupsService } from './internal-groups.service';
import { InternalMetricsService } from './internal-metrics.service';
import {
  InternalDashboardController,
  InternalGroupsController,
  InternalJobsController,
  InternalMetricsController,
} from './internal.controller';

@Module({
  imports: [JobsModule],
  controllers: [
    InternalJobsController,
    InternalGroupsController,
    InternalMetricsController,
    InternalDashboardController,
  ],
  providers: [InternalGroupsService, InternalMetricsService, InternalDashboardService],
})
export class InternalModule {}
