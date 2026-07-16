import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  DATABASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_URL: z.string().optional().default(''),
  ADMIN_TELEGRAM_USER_IDS: z.string().optional().default(''),
  INTERNAL_ADMIN_TOKEN: z.string().optional().default(''),
  DASHBOARD_URL: z.string().optional().default('http://127.0.0.1:5173'),
  AUTH_SESSION_SECRET: z.string().optional().default(''),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_OAUTH_CALLBACK_URL: z
    .string()
    .optional()
    .default('http://127.0.0.1:5173/auth/github/callback'),
  GITHUB_ADMIN_LOGIN: z.string().optional().default(''),
  GITHUB_ADMIN_ID: z.string().optional().default(''),
  ALERT_WEBHOOK_URL: z.string().optional().default(''),
  DAILY_REPORT_REMINDER_SCHEDULE: z.string().optional().default('0 21 * * *'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().optional().default(''),
  OPENROUTER_FALLBACK_MODEL: z.string().optional().default(''),
  OPENROUTER_APP_NAME: z.string().default('telegram-task-reporter'),
  OPENROUTER_SITE_URL: z.string().optional().default(''),
  REPORT_SCHEDULES: z.string().default('0 8 * * *,0 14 * * *,0 20 * * *'),
  AI_AUTO_APPLY_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.8),
  AI_REVIEW_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  AI_DAILY_COST_LIMIT_USD: z
    .union([z.literal(''), z.coerce.number().positive()])
    .optional()
    .default(''),
  OPENROUTER_INPUT_COST_PER_1M_TOKENS: z
    .union([z.literal(''), z.coerce.number().nonnegative()])
    .optional()
    .default(''),
  OPENROUTER_OUTPUT_COST_PER_1M_TOKENS: z
    .union([z.literal(''), z.coerce.number().nonnegative()])
    .optional()
    .default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PROCESS_ROLE: z.enum(['api', 'worker']).default('api'),
  RAW_PAYLOAD_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  NORMALIZED_MESSAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  AI_RAW_RESPONSE_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  return parsed.data;
}
