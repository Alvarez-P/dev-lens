import { Injectable } from '@nestjs/common';
import { Strategy } from 'passport-github2';
import { OAuthProviderConfig } from '../../../../config/configuration';
import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from '../../domain/external-identity-provider.interface';

interface OAuth2Internal {
  authorizeURL(params: Record<string, string>): string;
  getOAuthAccessToken(
    code: string,
    params: Record<string, string>,
    callback: (err: Error | null, accessToken: string, refreshToken: string) => void,
  ): void;
  get(url: string, accessToken: string, callback: (err: Error | null, body: string) => void): void;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

type GitHubStrategyInternal = Strategy & { _oauth2: OAuth2Internal };

function createStrategy(config: OAuthProviderConfig): GitHubStrategyInternal {
  const strategy = new Strategy(
    {
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackUrl,
      scope: ['user:email'],
    },
    () => {},
  ) as unknown as GitHubStrategyInternal;

  return strategy;
}

@Injectable()
export class GithubOAuthProvider implements ExternalIdentityProvider {
  readonly provider = 'github';
  private readonly oauth2: OAuth2Internal;

  constructor(config: OAuthProviderConfig) {
    const strategy = createStrategy(config);
    this.oauth2 = strategy._oauth2;
  }

  getProviderName(): string {
    return 'github';
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    return this.oauth2.authorizeURL({
      redirect_uri: redirectUri,
      state,
    });
  }

  async exchangeCode(code: string, redirectUri: string): Promise<ExternalUserProfile> {
    const { accessToken, refreshToken } = await this.getAccessToken(code, redirectUri);
    const userProfile = await this.getUserProfile(accessToken);
    const email = userProfile.email ?? (await this.getPrimaryEmail(accessToken));

    if (!email) {
      throw new Error(
        'GitHub account has no public email. Set email visibility to public in GitHub settings.',
      );
    }

    return {
      externalId: String(userProfile.id),
      email,
      displayName: userProfile.name || userProfile.login,
      avatarUrl: userProfile.avatar_url,
      accessToken,
      refreshToken: refreshToken || undefined,
    };
  }

  private getAccessToken(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    return new Promise((resolve, reject) => {
      this.oauth2.getOAuthAccessToken(
        code,
        { redirect_uri: redirectUri },
        (err: Error | null, accessToken: string, refreshToken: string) => {
          if (err) {
            reject(err);
          } else {
            resolve({ accessToken, refreshToken });
          }
        },
      );
    });
  }

  private getUserProfile(accessToken: string): Promise<GitHubUserResponse> {
    return new Promise((resolve, reject) => {
      this.oauth2.get(
        'https://api.github.com/user',
        accessToken,
        (err: Error | null, body: string) => {
          if (err) {
            reject(err);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Failed to parse GitHub user profile response'));
          }
        },
      );
    });
  }

  private getPrimaryEmail(accessToken: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.oauth2.get(
        'https://api.github.com/user/emails',
        accessToken,
        (err: Error | null, body: string) => {
          if (err) {
            resolve(null);
            return;
          }
          try {
            const emails: GitHubEmail[] = JSON.parse(body);
            const primary = emails.find((e) => e.primary && e.verified);
            resolve(primary?.email ?? null);
          } catch {
            resolve(null);
          }
        },
      );
    });
  }
}
