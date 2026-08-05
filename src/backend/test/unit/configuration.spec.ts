import configuration, {
  AppConfiguration,
  AnalysisConfig,
  OAuthConfig,
  OAuthProviderConfig,
} from '@/config/configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OAuthConfig shape', () => {
    it('should define OAuthProviderConfig with required fields', () => {
      const config: OAuthProviderConfig = {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        callbackUrl: 'http://localhost:3001/api/v1/auth/oauth/github/callback',
      };

      expect(config.clientId).toBe('test_client_id');
      expect(config.clientSecret).toBe('test_client_secret');
      expect(config.callbackUrl).toContain('/auth/oauth/github/callback');
    });

    it('should define OAuthConfig with github provider', () => {
      const config: OAuthConfig = {
        github: {
          clientId: 'github_client_id',
          clientSecret: 'github_client_secret',
          callbackUrl: 'http://localhost:3001/api/v1/auth/oauth/github/callback',
        },
        tokenEncryptionKey: 'test-key',
        stateSecret: 'test-state-secret',
      };

      expect(config.github.clientId).toBe('github_client_id');
      expect(config.github.clientSecret).toBe('github_client_secret');
    });
  });

  describe('oauth factory from environment', () => {
    it('should load github OAuth config from env vars', () => {
      process.env.GITHUB_CLIENT_ID = 'env_github_id';
      process.env.GITHUB_CLIENT_SECRET = 'env_github_secret';
      process.env.GITHUB_CALLBACK_URL = 'https://example.com/api/v1/auth/oauth/github/callback';
      process.env.AUTH_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32bytes!';

      const config: AppConfiguration = configuration();

      expect(config.oauth.github.clientId).toBe('env_github_id');
      expect(config.oauth.github.clientSecret).toBe('env_github_secret');
      expect(config.oauth.github.callbackUrl).toBe(
        'https://example.com/api/v1/auth/oauth/github/callback',
      );
    });

    it('should use default callback URL when env var is not set', () => {
      process.env.GITHUB_CLIENT_ID = 'env_github_id';
      process.env.GITHUB_CLIENT_SECRET = 'env_github_secret';
      process.env.AUTH_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32bytes!';

      const config: AppConfiguration = configuration();

      expect(config.oauth.github.callbackUrl).toContain('localhost:3001');
      expect(config.oauth.github.callbackUrl).toContain('/auth/oauth/github/callback');
    });

    it('should have default token encryption key', () => {
      process.env.GITHUB_CLIENT_ID = 'env_github_id';
      process.env.GITHUB_CLIENT_SECRET = 'env_github_secret';

      const config: AppConfiguration = configuration();

      expect(config.oauth.tokenEncryptionKey).toBeDefined();
    });

    it('should load token encryption key from env', () => {
      process.env.GITHUB_CLIENT_ID = 'env_github_id';
      process.env.GITHUB_CLIENT_SECRET = 'env_github_secret';
      process.env.AUTH_TOKEN_ENCRYPTION_KEY = 'custom-encryption-key';

      const config: AppConfiguration = configuration();

      expect(config.oauth.tokenEncryptionKey).toBe('custom-encryption-key');
    });
  });

  describe('AnalysisConfig', () => {
    it('should define an AnalysisConfig with a staticAnalysisThreshold', () => {
      const analysis: AnalysisConfig = { staticAnalysisThreshold: 0.5 };

      expect(analysis.staticAnalysisThreshold).toBe(0.5);
    });

    it('should default staticAnalysisThreshold to 0.5', () => {
      delete process.env.STATIC_ANALYSIS_THRESHOLD;

      const config: AppConfiguration = configuration();

      expect(config.analysis.staticAnalysisThreshold).toBe(0.5);
    });

    it('should load staticAnalysisThreshold from the STATIC_ANALYSIS_THRESHOLD env var', () => {
      process.env.STATIC_ANALYSIS_THRESHOLD = '0.8';

      const config: AppConfiguration = configuration();

      expect(config.analysis.staticAnalysisThreshold).toBe(0.8);
    });
  });
});
