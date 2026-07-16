import { Module } from '@nestjs/common';
import { AiRepository } from './ai.repository';
import { MessageChunkerService } from './message-chunker.service';
import { OpenRouterClient } from './openrouter.client';
import { TaskExtractorService } from './task-extractor.service';

@Module({
  providers: [AiRepository, OpenRouterClient, TaskExtractorService, MessageChunkerService],
  exports: [TaskExtractorService, OpenRouterClient, MessageChunkerService],
})
export class AiModule {}
