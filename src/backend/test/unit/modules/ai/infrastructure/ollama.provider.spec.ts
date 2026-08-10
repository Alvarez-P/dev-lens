import { lastValueFrom, Observable, tap } from 'rxjs';
import { OllamaProvider } from '@/modules/ai/infrastructure/ollama.provider';
import {
  AIChunk,
  AIRequest,
  AIResponse,
  AIEnrichmentRequest,
} from '@/modules/ai/domain/ai-request.vo';
import {
  ProviderUnavailableError,
  AIRateLimitError,
  AIAuthenticationError,
  AIInvalidResponseError,
} from '@/modules/ai/domain/ai-errors';
import { AIProviderConfig } from '@/config/configuration';

type FetchLike = typeof fetch;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Ollama /api/generate NDJSON stream body (one JSON object per line). */
const ndjsonResponse = (lines: unknown[]): Response => {
  const encoder = new TextEncoder();
  const body = lines.map((line) => JSON.stringify(line)).join('\n') + '\n';

  return new Response(encoder.encode(body), {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
};

const tokenLine = (response: string, done = false): unknown => ({
  model: 'llama3.2',
  response,
  done,
});

const doneLine = (evalCount: number): unknown => ({
  model: 'llama3.2',
  response: '',
  done: true,
  prompt_eval_count: 10,
  eval_count: evalCount,
});

const providerConfig: AIProviderConfig = {
  enabled: true,
  baseUrl: 'http://localhost:11434',
  defaultModel: 'llama3.2',
};

const request: AIRequest = {
  messages: [
    { role: 'system', content: 'classify' },
    { role: 'user', content: 'users.controller.ts' },
  ],
  temperature: 0.2,
};

describe('OllamaProvider', () => {
  let fetchMock: jest.Mock<ReturnType<FetchLike>>;

  const createProvider = (
    config: AIProviderConfig | undefined = providerConfig,
    timeoutMs = 1000,
  ): OllamaProvider => new OllamaProvider(config, timeoutMs, fetchMock);

  beforeEach(() => {
    fetchMock = jest.fn();
  });

  describe('provider metadata', () => {
    it('should expose stable id, name and supportedModels for the router', () => {
      const provider = createProvider();

      expect(provider.id).toBe('ollama');
      expect(provider.name).toBe('Ollama');
      expect(provider.supportedModels).toEqual(['llama3.2']);
    });

    it('should derive the model and base URL from the PR4 AIProviderConfig section', () => {
      const provider = createProvider({
        enabled: true,
        baseUrl: 'http://ollama.internal:8080',
        defaultModel: 'qwen2.5',
      });

      expect(provider.supportedModels).toEqual(['qwen2.5']);
    });

    it('should fall back to default model when no config section is provided', () => {
      const provider = createProvider(undefined);

      expect(provider.supportedModels).toEqual(['llama3.2']);
    });
  });

  describe('complete', () => {
    it('should POST to /api/generate using the config base URL and return an AIResponse', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          model: 'llama3.2',
          response: '{"framework":"nestjs"}',
          done: true,
          prompt_eval_count: 100,
          eval_count: 25,
        }),
      );

      const provider = createProvider();
      const response: AIResponse = await provider.complete(request);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":false'),
        }),
      );
      expect(response.content).toBe('{"framework":"nestjs"}');
      expect(response.model).toBe('llama3.2');
      expect(response.tokensUsed).toEqual({ input: 100, output: 25 });
      expect(response.finishReason).toBe('stop');
    });

    it('should wrap an HTTP 429 in AIRateLimitError', async () => {
      fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIRateLimitError);
    });

    it('should wrap an HTTP 401 in a non-retriable AIAuthenticationError', async () => {
      fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }));

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIAuthenticationError);
      await expect(provider.complete(request)).rejects.toMatchObject({
        code: 'AI_AUTHENTICATION',
        statusCode: 401,
        retriable: false,
        provider_id: 'ollama',
      });
    });

    it('should wrap an HTTP 500 in ProviderUnavailableError', async () => {
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
    });

    it('should wrap a network failure in ProviderUnavailableError', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
    });
  });

  describe('enrich', () => {
    it('should request JSON output and parse the enrichment response', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          model: 'llama3.2',
          response: JSON.stringify({
            framework: 'nestjs',
            architecture: 'mvc',
            confidence: 0.85,
            classes: [
              {
                fqn: 'acme:src/users#UsersController',
                role: 'controller',
                lifecycle: ['handler'],
                dtoFields: [],
                confidence: 0.9,
                sourceFile: 'src/users/users.controller.ts',
              },
            ],
          }),
          done: true,
        }),
      );

      const provider = createProvider();
      const enrichmentRequest: AIEnrichmentRequest = {
        messages: [{ role: 'user', content: 'classify' }],
        capability: 'classify-lifecycle',
        framework: 'nestjs',
        manifestSha256: 'abc123',
      };

      const response = await provider.enrich(enrichmentRequest);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"format":"json"'),
        }),
      );
      expect(response.framework).toBe('nestjs');
      expect(response.classes[0].role).toBe('controller');
    });

    it('should throw AIInvalidResponseError on malformed JSON from the model', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ model: 'llama3.2', response: 'not json', done: true }),
      );

      const provider = createProvider();

      await expect(
        provider.enrich({
          messages: [],
          capability: 'classify-lifecycle',
          framework: 'nestjs',
          manifestSha256: 'abc123',
        }),
      ).rejects.toBeInstanceOf(AIInvalidResponseError);
    });
  });

  describe('healthCheck', () => {
    it('should return true when GET /api/tags succeeds with 200', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ models: [] }, 200));

      const provider = createProvider();

      await expect(provider.healthCheck()).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.anything());
    });

    it('should return false on non-200 response', async () => {
      fetchMock.mockResolvedValue(new Response('down', { status: 503 }));

      const provider = createProvider();

      await expect(provider.healthCheck()).resolves.toBe(false);
    });

    it('should return false on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const provider = createProvider();

      await expect(provider.healthCheck()).resolves.toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should return a token-based cost estimate', () => {
      const provider = createProvider();

      const cost = provider.estimateCost({
        messages: [{ role: 'user', content: 'hello world' }],
      });

      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('streamComplete', () => {
    it('should stream token chunks and finish with a done chunk carrying usage', async () => {
      fetchMock.mockResolvedValue(
        ndjsonResponse([tokenLine('Hello'), tokenLine(' world'), doneLine(5)]),
      );

      const provider = createProvider();
      const chunks: AIChunk[] = [];

      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunks.push(c))));

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":true'),
          signal: expect.any(AbortSignal),
        }),
      );
      expect(chunks.filter((c) => c.type === 'token').map((c) => c.content)).toEqual([
        'Hello',
        ' world',
      ]);
      expect(chunks.at(-1)).toMatchObject({
        type: 'done',
        tokens: 5,
        model: 'llama3.2',
      });
    });

    it('should ignore empty deltas and still emit a done chunk', async () => {
      fetchMock.mockResolvedValue(ndjsonResponse([tokenLine(''), doneLine(0)]));

      const provider = createProvider();
      const chunks: AIChunk[] = [];

      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunks.push(c))));

      expect(chunks.filter((c) => c.type === 'token')).toHaveLength(0);
      expect(chunks.at(-1)).toMatchObject({ type: 'done', tokens: 0 });
    });

    it('should map a non-OK streaming response to a typed error', async () => {
      fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));

      const provider = createProvider();

      await expect(lastValueFrom(provider.streamComplete(request))).rejects.toBeInstanceOf(
        AIRateLimitError,
      );
    });

    it('should map a mid-stream network failure to ProviderUnavailableError', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      const provider = createProvider();

      await expect(lastValueFrom(provider.streamComplete(request))).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
    });

    it('should abort the in-flight request when unsubscribed', async () => {
      const pending = new Promise<Response>(() => {
        /* never resolves — stream stays open */
      });
      fetchMock.mockReturnValue(pending as unknown as ReturnType<FetchLike>);

      const provider = createProvider();
      const subscription = provider.streamComplete(request).subscribe();

      subscription.unsubscribe();

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.signal?.aborted).toBe(true);
    });

    it('should return an Observable even with an empty request', () => {
      const provider = createProvider();

      expect(provider.streamComplete({ messages: [] })).toBeInstanceOf(Observable);
    });
  });
});
