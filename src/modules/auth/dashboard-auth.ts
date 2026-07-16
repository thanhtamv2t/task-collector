import { UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';

export const DASHBOARD_SESSION_COOKIE = 'task_reporter_session';
export const GITHUB_OAUTH_STATE_COOKIE = 'task_reporter_oauth_state';

export type DashboardSession = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  expiresAt: number;
};

export type DashboardAuthConfig = Pick<
  ConfigType<typeof appConfig>,
  | 'nodeEnv'
  | 'internalAdminToken'
  | 'authSessionSecret'
  | 'githubAdminLogin'
  | 'githubAdminId'
>;

export function createOauthState(): string {
  return randomBytes(24).toString('base64url');
}

export function createSessionToken(session: DashboardSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function readDashboardSession(
  cookieHeader: string | undefined,
  secret: string,
): DashboardSession | null {
  const token = parseCookies(cookieHeader)[DASHBOARD_SESSION_COOKIE];
  if (!token || !secret) {
    return null;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DashboardSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function readOauthState(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)[GITHUB_OAUTH_STATE_COOKIE];
}

export function assertInternalAuthorized(
  app: DashboardAuthConfig,
  token: string | undefined,
  cookieHeader: string | undefined,
): void {
  const session = readDashboardSession(cookieHeader, app.authSessionSecret);
  if (session && isAllowedAdmin(session, app)) {
    return;
  }

  if (!app.internalAdminToken && app.nodeEnv !== 'production') {
    return;
  }

  if (!app.internalAdminToken || token !== app.internalAdminToken) {
    throw new UnauthorizedException('GitHub admin login required');
  }
}

export function isAllowedAdmin(session: Pick<DashboardSession, 'id' | 'login'>, app: DashboardAuthConfig): boolean {
  const allowedLogin = app.githubAdminLogin.trim().toLowerCase();
  const allowedId = app.githubAdminId.trim();

  if (!allowedLogin && !allowedId) {
    return app.nodeEnv !== 'production';
  }

  return (
    (allowedLogin ? session.login.toLowerCase() === allowedLogin : false) ||
    (allowedId ? String(session.id) === allowedId : false)
  );
}

export function buildCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds?: number; nodeEnv: string },
): string {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    options.nodeEnv === 'production' ? 'Secure' : '',
    options.maxAgeSeconds === 0 ? 'Max-Age=0' : `Max-Age=${options.maxAgeSeconds ?? 43_200}`,
  ].filter(Boolean);

  return parts.join('; ');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim().split('='))
      .filter(([name, value]) => name && value)
      .map(([name, value]) => [name, decodeURIComponent(value)]),
  );
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
