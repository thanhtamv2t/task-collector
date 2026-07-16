import { Module } from '@nestjs/common';
import { CollectorModule } from '../collector/collector.module';
import { TelegramBotModule } from './telegram-bot.module';
import { TelegramController } from './telegram.controller';
import { TelegramUpdateParser } from './telegram-update.parser';

@Module({
  imports: [CollectorModule, TelegramBotModule],
  controllers: [TelegramController],
  providers: [TelegramUpdateParser],
})
export class TelegramModule {}
