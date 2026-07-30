const mockOAuth2 = {
  getAuthorizeUrl: jest
    .fn()
    .mockReturnValue('https://github.com/login/oauth/authorize?state=mock_state'),
  getOAuthAccessToken: jest.fn(),
  get: jest.fn(),
};

jest.mock('passport-github2', () => ({
  Strategy: jest.fn().mockImplementation(() => ({
    name: 'github',
    _oauth2: mockOAuth2,
  })),
}));

import { GithubOAuthProvider } from '@/modules/identity/infrastructure/auth/github-oauth.provider';

const mockUserResponse = JSON.stringify({
  id: 583231,
  login: 'octocat',
  email: 'octocat@github.com',
  name: 'Octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/583231',
});

const mockEmailsResponse = JSON.stringify([
  { email: 'octocat@github.com', primary: true, verified: true },
]);

describe('GithubOAuthProvider', () => {
  let provider: GithubOAuthProvider;

  const config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    callbackUrl: 'http://localhost:3001/api/v1/auth/oauth/github/callback',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GithubOAuthProvider(config);
  });

  describe('getProviderName', () => {
    it('should return "github"', () => {
      expect(provider.getProviderName()).toBe('github');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return a GitHub authorization URL with state and redirect', () => {
      const url = provider.getAuthorizationUrl('csrf-state-123', 'http://localhost:3001/callback');

      expect(url).toBe('https://github.com/login/oauth/authorize?state=mock_state');
      expect(mockOAuth2.getAuthorizeUrl).toHaveBeenCalledWith({
        redirect_uri: 'http://localhost:3001/callback',
        state: 'csrf-state-123',
      });
    });
  });

  describe('exchangeCode', () => {
    beforeEach(() => {
      mockOAuth2.getOAuthAccessToken.mockImplementation(
        (_code: string, _options: any, callback: any) => {
          callback(null, 'mock_gh_access_token_123', 'ghr_refresh_token_456');
        },
      );

      mockOAuth2.get.mockImplementation(
        (url: string, _token: string, callback: (err: Error | null, body: string) => void) => {
          if (url.includes('/user/emails')) {
            callback(null, mockEmailsResponse);
          } else {
            callback(null, mockUserResponse);
          }
        },
      );
    });

    it('should return an ExternalUserProfile from raw GitHub API response', async () => {
      const profile = await provider.exchangeCode('code_abc', 'http://localhost:3001/callback');

      expect(profile.externalId).toBe('583231');
      expect(profile.email).toBe('octocat@github.com');
      expect(profile.displayName).toBe('Octocat');
      expect(profile.avatarUrl).toBe('https://avatars.githubusercontent.com/u/583231');
      expect(profile.accessToken).toBe('mock_gh_access_token_123');
      expect(profile.refreshToken).toBe('ghr_refresh_token_456');
    });

    it('should fall back to login when name is null', async () => {
      mockOAuth2.get.mockImplementation(
        (url: string, _token: string, callback: (err: Error | null, body: string) => void) => {
          if (url.includes('/user/emails')) {
            callback(null, mockEmailsResponse);
          } else {
            callback(
              null,
              JSON.stringify({
                id: 1,
                login: 'no-name',
                email: 'x@x.com',
                name: null,
                avatar_url: '',
              }),
            );
          }
        },
      );

      const profile = await provider.exchangeCode('code', 'http://localhost:3001/callback');
      expect(profile.displayName).toBe('no-name');
    });

    it('should fetch emails when user email is null', async () => {
      mockOAuth2.get.mockImplementation(
        (url: string, _token: string, callback: (err: Error | null, body: string) => void) => {
          if (url.includes('/user/emails')) {
            callback(null, mockEmailsResponse);
          } else {
            callback(
              null,
              JSON.stringify({
                id: 1,
                login: 'private',
                email: null,
                name: 'Private',
                avatar_url: '',
              }),
            );
          }
        },
      );

      const profile = await provider.exchangeCode('code', 'http://localhost:3001/callback');
      expect(profile.email).toBe('octocat@github.com');
    });

    it('should reject on token exchange error', async () => {
      mockOAuth2.getOAuthAccessToken.mockImplementation(
        (_code: string, _options: any, callback: any) => {
          callback(new Error('token_exchange_failed'));
        },
      );

      await expect(
        provider.exchangeCode('bad_code', 'http://localhost:3001/callback'),
      ).rejects.toThrow('token_exchange_failed');
    });

    it('should reject on profile fetch error', async () => {
      mockOAuth2.get.mockImplementation(
        (_url: string, _token: string, callback: (err: Error | null, body?: string) => void) => {
          callback(new Error('profile_fetch_failed'));
        },
      );

      await expect(
        provider.exchangeCode('code_abc', 'http://localhost:3001/callback'),
      ).rejects.toThrow('profile_fetch_failed');
    });

    it('should reject when no email is available', async () => {
      mockOAuth2.get.mockImplementation(
        (url: string, _token: string, callback: (err: Error | null, body: string) => void) => {
          if (url.includes('/user/emails')) {
            callback(null, '[]');
          } else {
            callback(
              null,
              JSON.stringify({
                id: 1,
                login: 'noemail',
                email: null,
                name: 'No Email',
                avatar_url: '',
              }),
            );
          }
        },
      );

      await expect(provider.exchangeCode('code', 'http://localhost:3001/callback')).rejects.toThrow(
        'no public email',
      );
    });
  });
});
