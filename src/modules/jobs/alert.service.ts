import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async jobFailed(input: { jobId: string; queue: string; data: unknown }): Promise<void> {
    const payload = {
      type: 'job_failed',
      jobId: input.jobId,
      queue: input.queue,
      data: input.data,
      occurredAt: new Date().toISOString(),
    };

    if (!this.app.alertWebhookUrl) {
      this.logger.warn(`Job failure alert: ${JSON.stringify(payload)}`);
      return;
    }

    await fetch(this.app.alertWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
