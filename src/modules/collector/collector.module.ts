import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { TasksModule } from '../tasks/tasks.module';
import { TelegramBotModule } from '../telegram/telegram-bot.module';
import { CollectorRepository } from './collector.repository';
import { CollectorService } from './collector.service';

@Module({
  imports: [TelegramBotModule, ReportsModule, TasksModule],
  providers: [CollectorRepository, CollectorService],
  exports: [CollectorService],
})
export class CollectorModule {}
