export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  signal?: AbortSignal;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  correlationId: string;
  timestamp: string;
  path: string;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30_000;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

const ACCESS_TOKEN_KEY = 'devlens_access_token';
const REFRESH_TOKEN_KEY = 'devlens_refresh_token';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function attemptTokenRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data = await response.json();
      if (data.success && data.data) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.data.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
        return true;
      }

      clearTokens();
      return false;
    } catch {
      clearTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function requestInterceptor(options: RequestOptions): RequestOptions {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return {
    ...options,
    headers,
  };
}

async function responseInterceptor<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    if (response.status === 401) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        throw new RetryableError('Token refreshed, please retry');
      } else {
        if (typeof window !== 'undefined') {
          clearTokens();
          window.location.href = '/login';
        }
      }
    }

    let errorBody: ApiErrorResponse;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {
        statusCode: response.status,
        message: `HTTP ${response.status}: ${response.statusText}`,
        error: 'HTTP_ERROR',
        correlationId: response.headers.get('x-correlation-id') || 'unknown',
        timestamp: new Date().toISOString(),
        path: '',
      };
    }

    throw new ApiError(errorBody.message, errorBody.statusCode, errorBody.correlationId);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE_URL}${path}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const interceptedOptions = requestInterceptor(options);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  const signal = options.signal
    ? combineAbortSignals(options.signal, controller.signal)
    : controller.signal;

  const doFetch = async (): Promise<ApiResponse<T>> => {
    const response = await fetch(url.toString(), {
      method,
      headers: interceptedOptions.headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    return responseInterceptor<T>(response);
  };

  try {
    return await doFetch();
  } catch (error) {
    if (error instanceof RetryableError) {
      const retryOptions = requestInterceptor(options);
      const response = await fetch(url.toString(), {
        method,
        headers: retryOptions.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
      return responseInterceptor<T>(response);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }

    throw new ApiError(error instanceof Error ? error.message : 'Unknown network error', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }

    signal.addEventListener(
      'abort',
      () => {
        controller.abort(signal.reason);
      },
      { once: true },
    );
  }

  return controller.signal;
}

export function get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>('GET', path, undefined, options);
}

export function post<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body, options);
}

export function put<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('PUT', path, body, options);
}

export function patch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('PATCH', path, body, options);
}

export function del<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path, undefined, options);
}
