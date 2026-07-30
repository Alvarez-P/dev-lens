export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'devlens_access_token',
  REFRESH_TOKEN: 'devlens_refresh_token',
} as const;

export const OAUTH_ENDPOINTS = {
  TOKEN_EXCHANGE: '/api/v1/auth/oauth/token',
  PROVIDER_AUTH: (provider: string) => `/api/v1/auth/oauth/${provider}`,
} as const;

export const ENV_KEYS = {
  GITHUB_CLIENT_ID: 'NEXT_PUBLIC_GITHUB_CLIENT_ID',
  API_URL: 'NEXT_PUBLIC_API_URL',
} as const;

export const AUTH_CALLBACK_PATH = '/auth/callback' as const;
