import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/config/validation';

describe('validateEnv', () => {
  it('accepts empty Telegram and OpenRouter keys for local bootstrap', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://telegram_reporter:password@localhost:5432/telegram_reporter',
    });

    expect(env.TELEGRAM_BOT_TOKEN).toBe('');
    expect(env.OPENROUTER_API_KEY).toBe('');
    expect(env.APP_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(env.RAW_PAYLOAD_RETENTION_DAYS).toBe(90);
    expect(env.NORMALIZED_MESSAGE_RETENTION_DAYS).toBe(180);
    expect(env.AI_RAW_RESPONSE_RETENTION_DAYS).toBe(30);
  });

  it('rejects invalid confidence thresholds', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://telegram_reporter:password@localhost:5432/telegram_reporter',
        AI_AUTO_APPLY_CONFIDENCE: '2',
      }),
    ).toThrow('Invalid environment');
  });
});
