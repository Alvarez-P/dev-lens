/**
 * Enhanced API client for the DevLens API.
 * Provides typed HTTP methods with request/response interceptors,
 * error handling, query params, and timeout support.
 */

/**
 * Custom error class for API errors.
 * Includes status code and correlation ID when available.
 */
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
const DEFAULT_TIMEOUT = 30_000; // 30 seconds

/**
 * Request interceptor — runs before every request.
 * Can modify headers, add auth tokens, etc.
 */
function requestInterceptor(options: RequestOptions): RequestOptions {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add correlation ID if available (from client-side storage or meta)
  // In future epics, this will also add auth headers

  return {
    ...options,
    headers,
  };
}

/**
 * Response interceptor — runs after every response.
 * Can transform data, handle errors, etc.
 */
async function responseInterceptor<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE_URL}${path}`);

  // Append query params
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

  // Combine the caller's signal with our timeout signal
  const signal = options.signal
    ? combineAbortSignals(options.signal, controller.signal)
    : controller.signal;

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: interceptedOptions.headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    return responseInterceptor<T>(response);
  } catch (error) {
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

/**
 * Combine two AbortSignals into one.
 */
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

/**
 * Send a GET request.
 */
export function get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>('GET', path, undefined, options);
}

/**
 * Send a POST request.
 */
export function post<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body, options);
}

/**
 * Send a PUT request.
 */
export function put<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('PUT', path, body, options);
}

/**
 * Send a PATCH request.
 */
export function patch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('PATCH', path, body, options);
}

/**
 * Send a DELETE request.
 */
export function del<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path, undefined, options);
}
