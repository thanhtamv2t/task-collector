import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { aiConfig } from '../../config/ai.config';

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface OpenRouterResult {
  content: string;
  model: string;
  usage: OpenRouterUsage | null;
  rawResponse: unknown;
}

interface OpenRouterChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: OpenRouterUsage;
}

@Injectable()
export class OpenRouterClient {
  constructor(
    @Inject(aiConfig.KEY)
    private readonly config: ConfigType<typeof aiConfig>,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.model);
  }

  primaryModel(): string {
    return this.config.model || this.config.fallbackModel || 'unconfigured';
  }

  async extractJson(prompt: string): Promise<OpenRouterResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter is not configured');
    }

    const models = [this.config.model, this.config.fallbackModel].filter(Boolean);
    let lastError: Error | null = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          return await this.request(model, prompt);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('OpenRouter request failed');
          if (attempt < 3) {
            await this.sleep(250 * 2 ** (attempt - 1));
          }
        }
      }
    }

    throw lastError ?? new Error('OpenRouter request failed');
  }

  private async request(model: string, prompt: string): Promise<OpenRouterResult> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
        'http-referer': this.config.siteUrl,
        'x-title': this.config.appName,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_object',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with status ${response.status}`);
    }

    const raw = (await response.json()) as OpenRouterChatResponse;
    const content = raw.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenRouter response did not include message content');
    }

    return {
      content,
      model: raw.model ?? model,
      usage: raw.usage ?? null,
      rawResponse: raw,
    };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
