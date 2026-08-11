import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

import { stream } from '../api-client';
import type { AIChunk } from '../api-client';

// Mirror how api-client resolves its base URL at module load.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Build a fetch Response-shaped object whose body streams SSE text. */
function sseResponse(pieces: string[], status = 200, statusText = 'OK'): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const piece of pieces) {
          controller.enqueue(encoder.encode(piece));
        }
        controller.close();
      },
    }),
  };
}

/** Drain a ReadableStream<AIChunk> into an array. */
async function collect(streamResult: ReadableStream<AIChunk>): Promise<AIChunk[]> {
  const chunks: AIChunk[] = [];
  const reader = streamResult.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return chunks;
}

describe('stream SSE parsing (task 6.2)', () => {
  it('parses token events from a text/event-stream response', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"token","content":"The"}\n\n',
        'data: {"type":"token","content":" OrderService"}\n\n',
      ]),
    );

    const { stream: s } = stream('/api/v1/ai/stream', {
      capability: 'explain-module',
      repoId: 'repo-1',
      nodeId: 'src/orders/OrderService',
    });

    expect(await collect(s)).toEqual([
      { type: 'token', content: 'The' },
      { type: 'token', content: ' OrderService' },
    ]);
  });

  it('handles a done chunk carrying tokens and model metadata', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"type":"done","content":"","tokens":12,"model":"mock-model"}\n\n']),
    );

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([
      { type: 'done', content: '', tokens: 12, model: 'mock-model' },
    ]);
  });

  it('passes error chunks through with their code', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"error","content":"AI provider unavailable","code":"PROVIDER_UNAVAILABLE"}\n\n',
      ]),
    );

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([
      { type: 'error', content: 'AI provider unavailable', code: 'PROVIDER_UNAVAILABLE' },
    ]);
  });

  it('reassembles an SSE event split across multiple network reads', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"token","content":"The"}\n\n',
        'data: {"type":"token","conten',
        't":" Order"}\n\n',
        'data: {"type":"done","content":"","tokens":',
        '3}\n\n',
      ]),
    );

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([
      { type: 'token', content: 'The' },
      { type: 'token', content: ' Order' },
      { type: 'done', content: '', tokens: 3 },
    ]);
  });

  it('ignores non-data SSE fields (retry, event) and comment lines', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        ': keepalive\n\n',
        'retry: 3000\n',
        'event: message\n',
        'data: {"type":"token","content":"ok"}\n\n',
      ]),
    );

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([{ type: 'token', content: 'ok' }]);
  });

  it('returns an empty stream for a response with no events', async () => {
    fetchMock.mockResolvedValue(sseResponse(['']));

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([]);
  });
});

describe('stream request construction', () => {
  it('GETs the path under the base URL and appends query params', async () => {
    fetchMock.mockResolvedValue(sseResponse(['']));

    const { stream: s } = stream('/api/v1/ai/stream', {
      capability: 'explain-module',
      repoId: 'repo-1',
      nodeId: 'src/orders/OrderService',
    });
    await collect(s);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `${BASE_URL}/api/v1/ai/stream?capability=explain-module&repoId=repo-1&nodeId=src%2Forders%2FOrderService`,
    );
    expect(init.method).toBe('GET');
  });

  it('omits params that are undefined', async () => {
    fetchMock.mockResolvedValue(sseResponse(['']));

    const { stream: s } = stream('/api/v1/ai/stream', {
      capability: 'explain-module',
      query: undefined,
    });
    await collect(s);

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE_URL}/api/v1/ai/stream?capability=explain-module`);
  });
});

describe('stream error handling', () => {
  it('emits an error chunk and closes when the HTTP response is not ok', async () => {
    fetchMock.mockResolvedValue(sseResponse([''], 503, 'Service Unavailable'));

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([{ type: 'error', content: 'HTTP 503: Service Unavailable' }]);
  });

  it('emits an error chunk and closes when the response has no body', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', body: null });

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([{ type: 'error', content: 'Empty response body' }]);
  });

  it('emits an error chunk and closes when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const { stream: s } = stream('/api/v1/ai/stream');

    expect(await collect(s)).toEqual([{ type: 'error', content: 'Network error' }]);
  });
});

describe('stream cancellation', () => {
  it('abort() aborts the fetch signal', async () => {
    fetchMock.mockResolvedValue(sseResponse(['data: {"type":"token","content":"x"}\n\n']));

    const { stream: s, abort } = stream('/api/v1/ai/stream');
    abort();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal.aborted).toBe(true);

    // Aborting a mock whose body still streams must not surface an error chunk.
    expect(await collect(s)).toEqual([{ type: 'token', content: 'x' }]);
  });

  it('combines an external AbortSignal via combineAbortSignals', async () => {
    fetchMock.mockResolvedValue(sseResponse(['']));
    const external = new AbortController();

    const { stream: s } = stream('/api/v1/ai/stream', undefined, { signal: external.signal });
    external.abort();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal.aborted).toBe(true);

    await collect(s);
  });
});
