import { Observable } from 'rxjs';
import { OllamaProvider } from '@/modules/ai/infrastructure/ollama.provider';
import { AIRequest, AIResponse, AIEnrichmentRequest } from '@/modules/ai/domain/ai-request.vo';
import {
  ProviderUnavailableError,
  AIRateLimitError,
  AIInvalidResponseError,
} from '@/modules/ai/domain/ai-errors';

type FetchLike = typeof fetch;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const request: AIRequest = {
  messages: [
    { role: 'system', content: 'classify' },
    { role: 'user', content: 'users.controller.ts' },
  ],
  temperature: 0.2,
};

describe('OllamaProvider', () => {
  let fetchMock: jest.Mock<ReturnType<FetchLike>>;

  beforeEach(() => {
    fetchMock = jest.fn();
  });

  describe('complete', () => {
    it('should POST to /api/generate and return an AIResponse', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          model: 'llama3.2',
          response: '{"framework":"nestjs"}',
          done: true,
          prompt_eval_count: 100,
          eval_count: 25,
        }),
      );

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);
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

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIRateLimitError);
    });

    it('should wrap an HTTP 500 in ProviderUnavailableError', async () => {
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
    });

    it('should wrap a network failure in ProviderUnavailableError', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

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

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);
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

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

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

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      await expect(provider.healthCheck()).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.anything());
    });

    it('should return false on non-200 response', async () => {
      fetchMock.mockResolvedValue(new Response('down', { status: 503 }));

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      await expect(provider.healthCheck()).resolves.toBe(false);
    });

    it('should return false on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      await expect(provider.healthCheck()).resolves.toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should return a token-based cost estimate', () => {
      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      const cost = provider.estimateCost({
        messages: [{ role: 'user', content: 'hello world' }],
      });

      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('streamComplete', () => {
    it('should return an Observable (MVP stub)', () => {
      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2', 1000, fetchMock);

      expect(provider.streamComplete({ messages: [] })).toBeInstanceOf(Observable);
    });
  });
});
