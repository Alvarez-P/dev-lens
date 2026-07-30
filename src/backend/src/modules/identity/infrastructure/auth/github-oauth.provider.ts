import { Injectable } from '@nestjs/common';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { OAuthProviderConfig } from '../../../../config/configuration';
import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from '../../domain/external-identity-provider.interface';

@Injectable()
export class GithubOAuthProvider implements ExternalIdentityProvider {
  readonly provider = 'github';
  private readonly strategy: GitHubStrategy;
  private readonly oauth2: any;

  constructor(config: OAuthProviderConfig) {
    this.strategy = new GitHubStrategy(
      {
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: config.callbackUrl,
        scope: ['user:email'],
      },
      () => {
        // No-op verify callback — flow is handled by exchangeCode
      },
    ) as any;

    this.oauth2 = (this.strategy as any)._oauth2;
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

  private getUserProfile(accessToken: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.strategy.userProfile(accessToken, (err?: Error | null, profile?: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(profile);
        }
      });
    });
  }
}
