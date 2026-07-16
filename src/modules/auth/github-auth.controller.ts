import { Controller, Get, Headers, Inject, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import {
  DASHBOARD_SESSION_COOKIE,
  GITHUB_OAUTH_STATE_COOKIE,
  buildCookie,
  createOauthState,
  createSessionToken,
  isAllowedAdmin,
  readDashboardSession,
  readOauthState,
} from './dashboard-auth';

type RedirectResponse = {
  redirect(url: string): void;
  setHeader(name: string, value: string | string[]): void;
};

type GitHubAccessTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

@Controller('auth')
export class GitHubAuthController {
  constructor(
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Get('github')
  start(@Res() response: RedirectResponse) {
    this.assertConfigured();

    const state = createOauthState();
    response.setHeader(
      'Set-Cookie',
      buildCookie(GITHUB_OAUTH_STATE_COOKIE, state, {
        nodeEnv: this.app.nodeEnv,
        maxAgeSeconds: 600,
      }),
    );

    const params = new URLSearchParams({
      client_id: this.app.githubOAuthClientId,
      redirect_uri: this.app.githubOAuthCallbackUrl,
      scope: 'read:user',
      state,
    });

    response.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }

  @Get('github/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Headers('cookie') cookieHeader: string | undefined,
    @Res() response: RedirectResponse,
  ) {
    this.assertConfigured();

    const expectedState = readOauthState(cookieHeader);
    if (!code || !state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException('Invalid GitHub OAuth state');
    }

    const accessToken = await this.exchangeCode(code);
    const user = await this.fetchGitHubUser(accessToken);
    if (!isAllowedAdmin({ id: user.id, login: user.login }, this.app)) {
      throw new UnauthorizedException('This GitHub account is not an admin');
    }

    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const sessionToken = createSessionToken(
      {
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        expiresAt,
      },
      this.app.authSessionSecret,
    );

    response.setHeader('Set-Cookie', [
      buildCookie(DASHBOARD_SESSION_COOKIE, encodeURIComponent(sessionToken), {
        nodeEnv: this.app.nodeEnv,
        maxAgeSeconds: 43_200,
      }),
      buildCookie(GITHUB_OAUTH_STATE_COOKIE, '', { nodeEnv: this.app.nodeEnv, maxAgeSeconds: 0 }),
    ]);
    response.redirect(this.app.dashboardUrl);
  }

  @Get('me')
  me(@Headers('cookie') cookieHeader: string | undefined) {
    const session = readDashboardSession(cookieHeader, this.app.authSessionSecret);
    if (!session || !isAllowedAdmin(session, this.app)) {
      throw new UnauthorizedException('GitHub admin login required');
    }

    return {
      id: session.id,
      login: session.login,
      name: session.name,
      avatarUrl: session.avatarUrl,
      expiresAt: session.expiresAt,
    };
  }

  @Get('logout')
  logout(@Res() response: RedirectResponse) {
    response.setHeader(
      'Set-Cookie',
      buildCookie(DASHBOARD_SESSION_COOKIE, '', { nodeEnv: this.app.nodeEnv, maxAgeSeconds: 0 }),
    );
    response.redirect(this.app.dashboardUrl);
  }

  private assertConfigured(): void {
    if (
      !this.app.githubOAuthClientId ||
      !this.app.githubOAuthClientSecret ||
      !this.app.authSessionSecret
    ) {
      throw new UnauthorizedException('GitHub OAuth is not configured');
    }
  }

  private async exchangeCode(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.app.githubOAuthClientId,
        client_secret: this.app.githubOAuthClientSecret,
        code,
        redirect_uri: this.app.githubOAuthCallbackUrl,
      }),
    });

    const body = (await response.json()) as GitHubAccessTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new UnauthorizedException(body.error_description ?? body.error ?? 'GitHub token exchange failed');
    }

    return body.access_token;
  }

  private async fetchGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${accessToken}`,
        'x-github-api-version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('GitHub user lookup failed');
    }

    return response.json() as Promise<GitHubUserResponse>;
  }
}
