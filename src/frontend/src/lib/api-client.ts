/**
 * Basic fetch wrapper for the DevLens API.
 * Provides typed get and post functions with error handling.
 */

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE_URL}${path}`);

  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: data.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      data: data as T,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    };
  }
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

export function del<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path, undefined, options);
}
