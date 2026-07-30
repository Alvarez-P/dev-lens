const mockOAuth2 = {
  authorizeURL: jest
    .fn()
    .mockReturnValue('https://github.com/login/oauth/authorize?state=mock_state'),
  getOAuthAccessToken: jest.fn(),
};

const mockUserProfile = jest.fn();

// Mock passport-github2
jest.mock('passport-github2', () => ({
  Strategy: jest.fn().mockImplementation(() => ({
    name: 'github',
    _oauth2: mockOAuth2,
    userProfile: mockUserProfile,
  })),
}));

import { GithubOAuthProvider } from './github-oauth.provider';

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
      expect(mockOAuth2.authorizeURL).toHaveBeenCalledWith({
        redirect_uri: 'http://localhost:3001/callback',
        state: 'csrf-state-123',
      });
    });
  });

  describe('exchangeCode', () => {
    it('should return an ExternalUserProfile on successful exchange', async () => {
      // Mock token exchange success
      mockOAuth2.getOAuthAccessToken.mockImplementation(
        (_code: string, _options: any, callback: any) => {
          callback(null, 'mock_gh_access_token_123', 'ghr_refresh_token_456');
        },
      );

      // Mock profile fetch success
      mockUserProfile.mockImplementation((_token: string, callback: any) => {
        callback(null, {
          id: '583231',
          displayName: 'Octocat',
          username: 'octocat',
          emails: [{ value: 'octocat@github.com' }],
          _json: { avatar_url: 'https://avatars.githubusercontent.com/u/583231' },
        });
      });

      const profile = await provider.exchangeCode('code_abc', 'http://localhost:3001/callback');

      expect(profile.externalId).toBe('583231');
      expect(profile.email).toBe('octocat@github.com');
      expect(profile.displayName).toBe('Octocat');
      expect(profile.avatarUrl).toBe('https://avatars.githubusercontent.com/u/583231');
      expect(profile.accessToken).toBe('mock_gh_access_token_123');
      expect(profile.refreshToken).toBe('ghr_refresh_token_456');

      // Verify OAuth2 was called with the code and redirect URI
      expect(mockOAuth2.getOAuthAccessToken).toHaveBeenCalledWith(
        'code_abc',
        { redirect_uri: 'http://localhost:3001/callback' },
        expect.any(Function),
      );
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
      mockOAuth2.getOAuthAccessToken.mockImplementation(
        (_code: string, _options: any, callback: any) => {
          callback(null, 'mock_gh_access_token_123');
        },
      );

      mockUserProfile.mockImplementation((_token: string, callback: any) => {
        callback(new Error('profile_fetch_failed'));
      });

      await expect(
        provider.exchangeCode('code_abc', 'http://localhost:3001/callback'),
      ).rejects.toThrow('profile_fetch_failed');
    });
  });
});
