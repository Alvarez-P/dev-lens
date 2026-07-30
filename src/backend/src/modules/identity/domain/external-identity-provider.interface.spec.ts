import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from './external-identity-provider.interface';

describe('ExternalIdentityProvider Interface', () => {
  describe('ExternalUserProfile shape', () => {
    it('should create a valid ExternalUserProfile with required fields', () => {
      const profile: ExternalUserProfile = {
        externalId: 'gh_12345',
        email: 'octocat@github.com',
        displayName: 'Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
        accessToken: 'mock_gh_xxxxx',
        refreshToken: 'ghr_xxxxx',
      };

      expect(profile.externalId).toBe('gh_12345');
      expect(profile.email).toBe('octocat@github.com');
      expect(profile.displayName).toBe('Octocat');
      expect(profile.avatarUrl).toBe('https://avatars.githubusercontent.com/u/583231');
      expect(profile.accessToken).toBe('mock_gh_xxxxx');
      expect(profile.refreshToken).toBe('ghr_xxxxx');
    });

    it('should allow ExternalUserProfile without optional fields', () => {
      const profile: ExternalUserProfile = {
        externalId: 'gl_67890',
        email: 'user@gitlab.com',
        displayName: 'GitLab User',
        accessToken: 'mock_gl_yyyyy',
      };

      expect(profile.externalId).toBe('gl_67890');
      expect(profile.refreshToken).toBeUndefined();
      expect(profile.avatarUrl).toBeUndefined();
    });
  });

  describe('ExternalIdentityProvider contract', () => {
    it('should be satisfied by a class that implements the interface', () => {
      class TestProvider implements ExternalIdentityProvider {
        readonly provider = 'test';

        getProviderName(): string {
          return 'test';
        }

        getAuthorizationUrl(state: string, redirectUri: string): string {
          return `https://test.com/oauth?state=${state}&redirect_uri=${redirectUri}`;
        }

        async exchangeCode(code: string, _redirectUri: string): Promise<ExternalUserProfile> {
          return {
            externalId: `test_${code}`,
            email: 'test@example.com',
            displayName: 'Test User',
            accessToken: 'test_token',
          };
        }
      }

      const provider = new TestProvider();

      expect(provider.provider).toBe('test');
      expect(provider.getProviderName()).toBe('test');
      expect(provider.getAuthorizationUrl('abc', 'http://localhost/callback')).toBe(
        'https://test.com/oauth?state=abc&redirect_uri=http://localhost/callback',
      );
    });

    it('should return a valid ExternalUserProfile from exchangeCode', async () => {
      class TestProvider implements ExternalIdentityProvider {
        readonly provider = 'test';

        getProviderName(): string {
          return 'test';
        }

        getAuthorizationUrl(state: string, redirectUri: string): string {
          return `https://test.com/oauth?state=${state}&redirect_uri=${redirectUri}`;
        }

        async exchangeCode(code: string, _redirectUri: string): Promise<ExternalUserProfile> {
          return {
            externalId: `ext_${code}`,
            email: `${code}@test.com`,
            displayName: `User ${code}`,
            avatarUrl: `https://test.com/avatar/${code}`,
            accessToken: `access_${code}`,
            refreshToken: `refresh_${code}`,
          };
        }
      }

      const provider = new TestProvider();
      const profile = await provider.exchangeCode('code123', 'http://localhost/callback');

      expect(profile.externalId).toBe('ext_code123');
      expect(profile.email).toBe('code123@test.com');
      expect(profile.displayName).toBe('User code123');
      expect(profile.avatarUrl).toBe('https://test.com/avatar/code123');
      expect(profile.accessToken).toBe('access_code123');
      expect(profile.refreshToken).toBe('refresh_code123');
    });
  });
});
