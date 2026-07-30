export interface ExternalUserProfile {
  externalId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
}

export interface ExternalIdentityProvider {
  readonly provider: string;

  getProviderName(): string;

  getAuthorizationUrl(state: string, redirectUri: string): string;

  exchangeCode(code: string, redirectUri: string): Promise<ExternalUserProfile>;
}
