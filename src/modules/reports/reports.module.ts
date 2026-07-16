import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { TelegramBotModule } from '../telegram/telegram-bot.module';
import { ReportFormatterService } from './report-formatter.service';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

@Module({
  imports: [AiModule, TelegramBotModule],
  providers: [ReportsRepository, ReportFormatterService, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
