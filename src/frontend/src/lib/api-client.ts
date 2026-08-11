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

import { STORAGE_KEYS } from '@/lib/constants';
import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearTokens as clearStoredTokens,
} from '@/lib/auth/token-storage';

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

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return 'success' in response && response.success === true;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30_000;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function clearTokens(): void {
  clearStoredTokens();
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
        storeTokens(data.data.accessToken, data.data.refreshToken);
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

export interface AIChunk {
  type: 'token' | 'done' | 'error';
  content: string;
  tokens?: number;
  model?: string;
  code?: string;
}

export interface StreamOptions {
  /** External signal merged with the internal one via `combineAbortSignals`. */
  signal?: AbortSignal;
}

export interface StreamResult {
  stream: ReadableStream<AIChunk>;
  abort: () => void;
}

/**
 * Parse one SSE event block (everything between two blank lines) into an
 * `AIChunk`. Only `data:` lines carry payload; `event:`/`id:`/`retry:` and
 * comment (`: ...`) lines are ignored. Malformed events are skipped.
 */
function parseSseEvent(block: string): AIChunk | null {
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join('\n')) as AIChunk;
  } catch {
    return null;
  }
}

/**
 * Streaming SSE client for the AI pipeline (task 6.2, PR15; ai-streaming R6).
 *
 * GETs `path` (e.g. `/api/v1/ai/stream?capability=...&repoId=...&nodeId=...`)
 * and exposes the parsed `token`/`done`/`error` chunks as a
 * `ReadableStream<AIChunk>`. Unlike `request()`, this is a raw fetch with no
 * JSON response interceptor and no timeout — streams are long-lived.
 *
 * Cancellation: call `abort()` (or abort an external signal passed via
 * `options.signal`, merged with `combineAbortSignals`) to cancel the fetch.
 * A user-initiated cancel closes the stream silently; network/HTTP failures
 * emit a single `{ type: 'error', content }` chunk before closing.
 */
export function stream(
  path: string,
  params?: Record<string, string>,
  options: StreamOptions = {},
): StreamResult {
  const url = new URL(`${BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    }
  }

  const controller = new AbortController();
  const signal = options.signal
    ? combineAbortSignals(controller.signal, options.signal)
    : controller.signal;

  const { headers } = requestInterceptor({});

  const fetchPromise = fetch(url.toString(), {
    method: 'GET',
    headers,
    signal,
  });

  const chunkStream = new ReadableStream<AIChunk>({
    async start(streamController) {
      try {
        const response = await fetchPromise;

        if (!response.ok) {
          streamController.enqueue({
            type: 'error',
            content: `HTTP ${response.status}: ${response.statusText}`,
          });
          streamController.close();
          return;
        }

        const body = response.body;
        if (!body) {
          streamController.enqueue({ type: 'error', content: 'Empty response body' });
          streamController.close();
          return;
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          // Normalize CRLF so SSE events always split on `\n\n`.
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const eventBlock = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const chunk = parseSseEvent(eventBlock);
            if (chunk) {
              streamController.enqueue(chunk);
            }

            boundary = buffer.indexOf('\n\n');
          }
        }

        streamController.close();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // User-initiated cancellation — close silently, no error chunk.
          streamController.close();
          return;
        }

        streamController.enqueue({
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown stream error',
        });
        streamController.close();
      }
    },
  });

  return { stream: chunkStream, abort: () => controller.abort() };
}
