export const OAUTH_ROUTES = {
  REDIRECT: ':provider',
  CALLBACK: ':provider/callback',
  TOKEN_EXCHANGE: 'token',
} as const;

export const OAUTH_BASE_PATH = 'auth/oauth' as const;

export const HTTP_STATUS = {
  FOUND: 302,
  OK: 200,
  BAD_REQUEST: 400,
  CONFLICT: 409,
} as const;

export const DB_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
} as const;

export const TOKEN_TTL_MS = 60_000 as const;

export const ENV_KEYS = {
  FRONTEND_URL: 'FRONTEND_URL',
  API_BASE_URL: 'API_BASE_URL',
  PORT: 'PORT',
} as const;

export const DEFAULT_FRONTEND_URL = 'http://localhost:3000' as const;
export const DEFAULT_PORT = '3001' as const;
