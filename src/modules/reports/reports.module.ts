import { Module } from '@nestjs/common';
import { TelegramBotModule } from '../telegram/telegram-bot.module';
import { ReportFormatterService } from './report-formatter.service';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

@Module({
  imports: [TelegramBotModule],
  providers: [ReportsRepository, ReportFormatterService, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
