import configuration, {
  AppConfiguration,
  AnalysisConfig,
  AiConfig,
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

  describe('AiConfig', () => {
    it('should define an AiConfig with AI section fields', () => {
      const ai: AiConfig = {
        enabled: true,
        providers: {
          openai: { api_key_env: 'OPENAI_API_KEY', model: 'gpt-4o', enabled: true },
          ollama: { base_url: 'http://localhost:11434', model: 'llama3.2', enabled: true },
          mock: { enabled: true },
        },
        default_model: 'ollama/llama3.2',
        timeout_ms: 60000,
        retry: { max_attempts: 2 },
        budget: { max_total_tokens: 6000 },
      };

      expect(ai.enabled).toBe(true);
      expect(ai.default_model).toBe('ollama/llama3.2');
      expect(ai.providers.openai.api_key_env).toBe('OPENAI_API_KEY');
      expect(ai.retry.max_attempts).toBe(2);
      expect(ai.budget.max_total_tokens).toBe(6000);
    });

    it('should default ai.enabled to false', () => {
      delete process.env.AI_ENABLED;

      const config: AppConfiguration = configuration();

      expect(config.ai.enabled).toBe(false);
    });

    it('should default ai.default_model to ollama/llama3.2', () => {
      delete process.env.AI_DEFAULT_MODEL;

      const config: AppConfiguration = configuration();

      expect(config.ai.default_model).toBe('ollama/llama3.2');
    });

    it('should default ai.timeout_ms to 60000', () => {
      delete process.env.AI_TIMEOUT_MS;

      const config: AppConfiguration = configuration();

      expect(config.ai.timeout_ms).toBe(60000);
    });

    it('should default retry.max_attempts to 2 and budget.max_total_tokens to 6000', () => {
      delete process.env.AI_RETRY_MAX_ATTEMPTS;
      delete process.env.AI_BUDGET_MAX_TOKENS;

      const config: AppConfiguration = configuration();

      expect(config.ai.retry.max_attempts).toBe(2);
      expect(config.ai.budget.max_total_tokens).toBe(6000);
    });

    it('should load ai.enabled from the AI_ENABLED env var', () => {
      process.env.AI_ENABLED = 'true';

      const config: AppConfiguration = configuration();

      expect(config.ai.enabled).toBe(true);
    });

    it('should load default_model from AI_DEFAULT_MODEL env var', () => {
      process.env.AI_DEFAULT_MODEL = 'openai/gpt-4o';

      const config: AppConfiguration = configuration();

      expect(config.ai.default_model).toBe('openai/gpt-4o');
    });

    it('should load provider configs from env vars', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.OPENAI_MODEL = 'gpt-4o-mini';
      process.env.OLLAMA_BASE_URL = 'http://ollama:11434';
      process.env.OLLAMA_MODEL = 'codellama';

      const config: AppConfiguration = configuration();

      expect(config.ai.providers.openai).toBeDefined();
      expect(config.ai.providers.openai.api_key_env).toBe('OPENAI_API_KEY');
      expect(config.ai.providers.openai.model).toBe('gpt-4o-mini');
      expect(config.ai.providers.ollama.base_url).toBe('http://ollama:11434');
      expect(config.ai.providers.ollama.model).toBe('codellama');
    });

    it('should default provider base_url and model when env vars absent', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_MODEL;
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.OLLAMA_MODEL;

      const config: AppConfiguration = configuration();

      expect(config.ai.providers.ollama.base_url).toBe('http://localhost:11434');
      expect(config.ai.providers.ollama.model).toBe('llama3.2');
    });

    it('should load timeout, retry, and budget from env vars', () => {
      process.env.AI_TIMEOUT_MS = '120000';
      process.env.AI_RETRY_MAX_ATTEMPTS = '3';
      process.env.AI_BUDGET_MAX_TOKENS = '8000';

      const config: AppConfiguration = configuration();

      expect(config.ai.timeout_ms).toBe(120000);
      expect(config.ai.retry.max_attempts).toBe(3);
      expect(config.ai.budget.max_total_tokens).toBe(8000);
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
