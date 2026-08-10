import { firstValueFrom, lastValueFrom, Observable, tap } from 'rxjs';
import OpenAI from 'openai';
import { OpenAIProvider } from '@/modules/ai/infrastructure/openai.provider';
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
  AIDidNotMeetSchemaError,
} from '@/modules/ai/domain/ai-errors';
import { AIProviderConfig } from '@/config/configuration';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
    models: { list: jest.fn() },
  })),
}));

const MockOpenAI = OpenAI as unknown as jest.Mock;
const mockCreate = jest.fn();
const mockList = jest.fn();

const providerConfig: AIProviderConfig = {
  enabled: true,
  defaultModel: 'gpt-4o',
  apiKeyEnv: 'OPENAI_API_KEY',
};

const createProvider = (
  config: AIProviderConfig | undefined = providerConfig,
  apiKey = 'sk-test',
  timeoutMs = 1000,
): OpenAIProvider => new OpenAIProvider(config, apiKey, timeoutMs);

/** Provider without an API key — the client is not created (use directly, not via createProvider). */
const createKeylessProvider = (): OpenAIProvider => new OpenAIProvider(providerConfig, undefined);

const request: AIRequest = {
  messages: [
    { role: 'system', content: 'classify' },
    { role: 'user', content: 'users.controller.ts' },
  ],
  model: 'gpt-4o',
  maxTokens: 100,
  temperature: 0.2,
  responseFormat: 'json_object',
};

/** Minimal OpenAI SDK stream chunk shapes (structural subset of ChatCompletionChunk). */
async function* sdkStream(chunks: unknown[]): AsyncGenerator<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

const tokenChunk = (id: string, content: string): unknown => ({
  id,
  object: 'chat.completion.chunk',
  choices: [{ index: 0, delta: { content }, finish_reason: null }],
});

const usageChunk = (tokens: number): unknown => ({
  id: 'final',
  object: 'chat.completion.chunk',
  choices: [],
  usage: { prompt_tokens: 10, completion_tokens: tokens, total_tokens: 10 + tokens },
});

describe('OpenAIProvider', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreate.mockReset();
    mockList.mockReset();
    MockOpenAI.mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
      models: { list: mockList },
    }));
  });

  describe('provider metadata', () => {
    it('should expose stable id, name and supportedModels for the router', () => {
      const provider = createProvider();

      expect(provider.id).toBe('openai');
      expect(provider.name).toBe('OpenAI');
      expect(provider.supportedModels).toEqual(['gpt-4o']);
    });

    it('should derive the model from the PR4 AIProviderConfig section', () => {
      const provider = createProvider({ ...providerConfig, defaultModel: 'gpt-4o-mini' });

      expect(provider.supportedModels).toEqual(['gpt-4o-mini']);
    });

    it('should fall back to a default model when no config section is provided', () => {
      const provider = createProvider(undefined, 'sk-test');

      expect(provider.supportedModels).toEqual(['gpt-4o']);
    });
  });

  describe('complete', () => {
    it('should map an AIRequest to chat.completions.create and return an AIResponse', async () => {
      mockCreate.mockResolvedValue({
        model: 'gpt-4o',
        choices: [
          {
            message: { content: '{"framework":"nestjs"}' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 40 },
      });

      const provider = createProvider();
      const response: AIResponse = await provider.complete(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          max_tokens: 100,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'classify' },
            { role: 'user', content: 'users.controller.ts' },
          ],
        }),
      );
      expect(response.content).toBe('{"framework":"nestjs"}');
      expect(response.model).toBe('gpt-4o');
      expect(response.tokensUsed).toEqual({ input: 120, output: 40 });
      expect(response.finishReason).toBe('stop');
    });

    it('should wrap a 429 response in AIRateLimitError', async () => {
      const apiError = new Error('rate limited');
      (apiError as unknown as { status: number }).status = 429;
      mockCreate.mockRejectedValue(apiError);

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIRateLimitError);
      await expect(provider.complete(request)).rejects.toMatchObject({
        code: 'AI_RATE_LIMIT',
        retriable: true,
        provider_id: 'openai',
      });
    });

    it('should wrap a 401 response in a non-retriable AIAuthenticationError', async () => {
      const apiError = new Error('invalid api key');
      (apiError as unknown as { status: number }).status = 401;
      mockCreate.mockRejectedValue(apiError);

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIAuthenticationError);
      await expect(provider.complete(request)).rejects.toMatchObject({
        code: 'AI_AUTHENTICATION',
        statusCode: 401,
        retriable: false,
      });
    });

    it('should wrap a 403 response in a non-retriable AIAuthenticationError', async () => {
      const apiError = new Error('forbidden');
      (apiError as unknown as { status: number }).status = 403;
      mockCreate.mockRejectedValue(apiError);

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIAuthenticationError);
      await expect(provider.complete(request)).rejects.toMatchObject({ retriable: false });
    });

    it('should wrap a 5xx or network error in ProviderUnavailableError', async () => {
      const apiError = new Error('service unavailable');
      (apiError as unknown as { status: number }).status = 503;
      mockCreate.mockRejectedValue(apiError);

      const provider = createProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
      await expect(provider.complete(request)).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        retriable: true,
      });
    });

    it('should reject with ProviderUnavailableError when no API key is configured', async () => {
      const provider = createKeylessProvider();

      await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('enrich', () => {
    it('should parse a JSON enrichment response into AIEnrichmentResponse', async () => {
      mockCreate.mockResolvedValue({
        model: 'gpt-4o',
        choices: [
          {
            message: {
              content: JSON.stringify({
                framework: 'nestjs',
                architecture: 'mvc',
                confidence: 0.9,
                classes: [
                  {
                    fqn: 'acme:src/users#UsersController',
                    role: 'controller',
                    lifecycle: ['handler'],
                    dtoFields: [],
                    confidence: 0.95,
                    sourceFile: 'src/users/users.controller.ts',
                  },
                ],
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const provider = createProvider();
      const enrichmentRequest: AIEnrichmentRequest = {
        messages: [{ role: 'user', content: 'classify' }],
        capability: 'classify-lifecycle',
        framework: 'nestjs',
        manifestSha256: 'abc123',
      };

      const response = await provider.enrich(enrichmentRequest);

      expect(response.framework).toBe('nestjs');
      expect(response.classes[0].role).toBe('controller');
      expect(response.classes[0].sourceFile).toBe('src/users/users.controller.ts');
    });

    it('should throw AIInvalidResponseError on malformed JSON', async () => {
      mockCreate.mockResolvedValue({
        model: 'gpt-4o',
        choices: [{ message: { content: 'not json{' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });

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

    it('should throw AIDidNotMeetSchemaError when required fields are missing', async () => {
      mockCreate.mockResolvedValue({
        model: 'gpt-4o',
        choices: [{ message: { content: '{"foo":"bar"}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });

      const provider = createProvider();

      await expect(
        provider.enrich({
          messages: [],
          capability: 'classify-lifecycle',
          framework: 'nestjs',
          manifestSha256: 'abc123',
        }),
      ).rejects.toBeInstanceOf(AIDidNotMeetSchemaError);
    });
  });

  describe('healthCheck', () => {
    it('should return true when models.list succeeds', async () => {
      mockList.mockResolvedValue({ data: [{ id: 'gpt-4o' }] });

      const provider = createProvider();

      await expect(provider.healthCheck()).resolves.toBe(true);
    });

    it('should return false when the client is missing an API key', async () => {
      const provider = createKeylessProvider();

      await expect(provider.healthCheck()).resolves.toBe(false);
    });

    it('should return false when models.list fails', async () => {
      mockList.mockRejectedValue(new Error('401 unauthorized'));

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
      mockCreate.mockResolvedValue(
        sdkStream([tokenChunk('1', 'Hello'), tokenChunk('2', ' world'), usageChunk(5)]),
      );

      const provider = createProvider();
      const chunks: AIChunk[] = [];

      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunks.push(c))));

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          stream: true,
          stream_options: { include_usage: true },
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(chunks.filter((c) => c.type === 'token').map((c) => c.content)).toEqual([
        'Hello',
        ' world',
      ]);
      expect(chunks.at(-1)).toMatchObject({
        type: 'done',
        tokens: 15,
        model: 'gpt-4o',
      });
    });

    it('should ignore empty deltas and still emit a done chunk', async () => {
      mockCreate.mockResolvedValue(
        sdkStream([
          {
            id: '1',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: null }],
          },
          usageChunk(0),
        ]),
      );

      const provider = createProvider();
      const chunks: AIChunk[] = [];

      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunks.push(c))));

      expect(chunks.filter((c) => c.type === 'token')).toHaveLength(0);
      expect(chunks.at(-1)).toMatchObject({ type: 'done' });
    });

    it('should map a mid-stream 429 to AIRateLimitError', async () => {
      const apiError = new Error('rate limited');
      (apiError as unknown as { status: number }).status = 429;
      mockCreate.mockRejectedValue(apiError);

      const provider = createProvider();

      await expect(firstValueFrom(provider.streamComplete(request))).rejects.toBeInstanceOf(
        AIRateLimitError,
      );
    });

    it('should emit ProviderUnavailableError when no API key is configured', async () => {
      const provider = createKeylessProvider();

      await expect(firstValueFrom(provider.streamComplete(request))).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should return an Observable even when the client is missing', () => {
      const provider = createKeylessProvider();

      const stream = provider.streamComplete({ messages: [] });

      expect(stream).toBeInstanceOf(Observable);
    });
  });
});
