import { Injectable } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class RetryFailedJob {
  constructor(private readonly repository: JobsRepository) {}

  async handle(): Promise<{ resetMessageCount: number }> {
    const resetMessageCount = await this.repository.resetFailedProcessingMessages();
    return { resetMessageCount };
  }
}
