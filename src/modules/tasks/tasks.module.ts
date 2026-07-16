import { Module } from '@nestjs/common';
import { TaskMatcherService } from './task-matcher.service';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  providers: [TasksRepository, TaskMatcherService, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
