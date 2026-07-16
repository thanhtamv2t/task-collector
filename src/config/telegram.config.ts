import { registerAs } from '@nestjs/config';

function parseAdminIds(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const telegramConfig = registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? '',
  adminTelegramUserIds: parseAdminIds(process.env.ADMIN_TELEGRAM_USER_IDS),
}));
