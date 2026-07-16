import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  model: process.env.OPENROUTER_MODEL ?? '',
  fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL ?? '',
  appName: process.env.OPENROUTER_APP_NAME ?? 'telegram-task-reporter',
  siteUrl: process.env.OPENROUTER_SITE_URL ?? '',
  autoApplyConfidence: Number(process.env.AI_AUTO_APPLY_CONFIDENCE ?? 0.8),
  reviewConfidence: Number(process.env.AI_REVIEW_CONFIDENCE ?? 0.5),
  dailyCostLimitUsd: process.env.AI_DAILY_COST_LIMIT_USD
    ? Number(process.env.AI_DAILY_COST_LIMIT_USD)
    : null,
  inputCostPer1MTokens: process.env.OPENROUTER_INPUT_COST_PER_1M_TOKENS
    ? Number(process.env.OPENROUTER_INPUT_COST_PER_1M_TOKENS)
    : null,
  outputCostPer1MTokens: process.env.OPENROUTER_OUTPUT_COST_PER_1M_TOKENS
    ? Number(process.env.OPENROUTER_OUTPUT_COST_PER_1M_TOKENS)
    : null,
}));
