import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  processRole: process.env.PROCESS_ROLE ?? 'api',
  internalAdminToken: process.env.INTERNAL_ADMIN_TOKEN ?? '',
  dashboardUrl: process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173',
  authSessionSecret: process.env.AUTH_SESSION_SECRET ?? process.env.INTERNAL_ADMIN_TOKEN ?? '',
  githubOAuthClientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? '',
  githubOAuthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? '',
  githubOAuthCallbackUrl:
    process.env.GITHUB_OAUTH_CALLBACK_URL ?? 'http://127.0.0.1:5173/auth/github/callback',
  githubAdminLogin: process.env.GITHUB_ADMIN_LOGIN ?? '',
  githubAdminId: process.env.GITHUB_ADMIN_ID ?? '',
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? '',
  rawPayloadRetentionDays: Number(process.env.RAW_PAYLOAD_RETENTION_DAYS ?? 90),
  normalizedMessageRetentionDays: Number(process.env.NORMALIZED_MESSAGE_RETENTION_DAYS ?? 180),
  aiRawResponseRetentionDays: Number(process.env.AI_RAW_RESPONSE_RETENTION_DAYS ?? 30),
}));
