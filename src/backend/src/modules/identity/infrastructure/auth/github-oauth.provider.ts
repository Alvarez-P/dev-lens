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
    const profile = await this.getUserProfile(accessToken);

    return {
      externalId: String(profile.id),
      email:
        Array.isArray(profile.emails) && profile.emails.length > 0 ? profile.emails[0].value : '',
      displayName: profile.displayName || profile.username || '',
      avatarUrl: profile._json?.avatar_url,
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

  private getUserProfile(
    accessToken: string,
  ): Promise<{
    id: number | string;
    emails?: { value: string }[];
    displayName?: string;
    username?: string;
    _json?: { avatar_url?: string };
  }> {
    return new Promise((resolve, reject) => {
      this.oauth2.get(
        'https://api.github.com/user',
        accessToken,
        (err: Error | null, body: string) => {
          if (err) {
            reject(err);
          } else {
            resolve(JSON.parse(body));
          }
        },
      );
    });
  }
}
