import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule, JobsModule],
  controllers: [HealthController],
})
export class HealthModule {}
