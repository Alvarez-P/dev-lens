export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

export interface RedisConfig {
  url: string;
}

export interface MinioConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
}

export interface RepoConfig {
  storagePath: string;
  credentialEncryptionKey: string;
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface OAuthConfig {
  github: OAuthProviderConfig;
  tokenEncryptionKey: string;
  stateSecret: string;
}

export interface AnalysisConfig {
  staticAnalysisThreshold: number;
}

export interface AIProviderConfig {
  /** Env var name holding the API key, e.g. 'OPENAI_API_KEY'. */
  apiKeyEnv?: string;
  /** Base URL for self-hosted providers (e.g. Ollama). */
  baseUrl?: string;
  /** Default model identifier for this provider. */
  defaultModel?: string;
  /** Whether this provider is allowed to be selected. */
  enabled: boolean;
}

export interface AiConfig {
  /** Master kill-switch for all AI features. */
  enabled: boolean;
  /** Provider configs keyed by provider name. */
  providers: Record<string, AIProviderConfig>;
  /** Default provider name, e.g. 'ollama'. */
  defaultProvider: string;
  /** Default model identifier, e.g. 'llama3.2'. */
  defaultModel: string;
  /** Per-request timeout in ms. */
  timeoutMs: number;
  retry: {
    /** Max LLM call attempts (including retries). */
    maxAttempts: number;
    /** Base backoff delay between retries in ms. */
    backoffMs: number;
  };
  budget: {
    /** Hard token budget per prompt. */
    maxTotalTokens: number;
  };
}

export interface DocumentationConfig {
  /** Master kill-switch for the documentation module (gates event handler). */
  enabled: boolean;
  /** Per-section AI enrichment gate (design decision B; generation R6). */
  aiEnabled: boolean;
}

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  apiBaseUrl?: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  minio: MinioConfig;
  auth: AuthConfig;
  repo: RepoConfig;
  oauth: OAuthConfig;
  analysis: AnalysisConfig;
  ai: AiConfig;
  documentation: DocumentationConfig;
  logLevel: string;
}

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiBaseUrl: process.env.API_BASE_URL,
  database: {
    url: process.env.DATABASE_URL || 'postgresql://devlens:devlens@localhost:5432/devlens',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'devlens',
    password: process.env.DB_PASS || 'devlens',
    name: process.env.DB_NAME || 'devlens',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'devlens',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  repo: {
    storagePath: process.env.REPO_STORAGE_PATH || '/tmp/devlens/repos',
    credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY || 'change-me-in-production',
  },
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GITHUB_CALLBACK_URL ||
        `http://localhost:${process.env.PORT || '3001'}/api/v1/auth/oauth/github/callback`,
    },
    tokenEncryptionKey: process.env.AUTH_TOKEN_ENCRYPTION_KEY || 'change-me-in-production',
    stateSecret:
      process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'change-me-in-production',
  },
  analysis: {
    staticAnalysisThreshold: parseFloat(process.env.STATIC_ANALYSIS_THRESHOLD || '0.5'),
  },
  ai: {
    enabled: process.env.AI_ENABLED === 'true',
    providers: {
      openai: {
        apiKeyEnv: 'OPENAI_API_KEY',
        defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
        enabled: Boolean(process.env.OPENAI_API_KEY),
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_MODEL || 'llama3.2',
        enabled: true,
      },
      mock: {
        enabled: true,
      },
      deepseek: {
        apiKeyEnv: 'DEEPSEEK_API_KEY',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        defaultModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        enabled: Boolean(process.env.DEEPSEEK_API_KEY),
      },
    },
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'deepseek',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'deepseek-chat',
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '60000', 10),
    retry: {
      maxAttempts: parseInt(process.env.AI_RETRY_MAX_ATTEMPTS || '2', 10),
      backoffMs: parseInt(process.env.AI_RETRY_BACKOFF_MS || '1000', 10),
    },
    budget: {
      maxTotalTokens: parseInt(process.env.AI_BUDGET_MAX_TOKENS || '6000', 10),
    },
  },
  logLevel: process.env.LOG_LEVEL || 'debug',
  documentation: {
    enabled: process.env.DOCUMENTATION_ENABLED !== 'false',
    aiEnabled: process.env.DOCUMENTATION_AI_ENABLED === 'true',
  },
});
