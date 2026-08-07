import { Observable } from 'rxjs';
import OpenAI from 'openai';
import { OpenAIProvider } from '@/modules/ai/infrastructure/openai.provider';
import { AIRequest, AIResponse, AIEnrichmentRequest } from '@/modules/ai/domain/ai-request.vo';
import {
  ProviderUnavailableError,
  AIRateLimitError,
  AIInvalidResponseError,
  AIDidNotMeetSchemaError,
} from '@/modules/ai/domain/ai-errors';

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

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);
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

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

      await expect(provider.complete(request)).rejects.toBeInstanceOf(AIRateLimitError);
      await expect(provider.complete(request)).rejects.toMatchObject({
        code: 'AI_RATE_LIMIT',
        retriable: true,
        provider_id: 'openai',
      });
    });

    it('should wrap a 5xx or network error in ProviderUnavailableError', async () => {
      const apiError = new Error('service unavailable');
      (apiError as unknown as { status: number }).status = 503;
      mockCreate.mockRejectedValue(apiError);

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

      await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
      await expect(provider.complete(request)).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        retriable: true,
      });
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

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);
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

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

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

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

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

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

      await expect(provider.healthCheck()).resolves.toBe(true);
    });

    it('should return false when the client is missing an API key', async () => {
      const provider = new OpenAIProvider('gpt-4o', undefined, 1000);

      await expect(provider.healthCheck()).resolves.toBe(false);
    });

    it('should return false when models.list fails', async () => {
      mockList.mockRejectedValue(new Error('401 unauthorized'));

      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

      await expect(provider.healthCheck()).resolves.toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should return a token-based cost estimate', () => {
      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

      const cost = provider.estimateCost({
        messages: [{ role: 'user', content: 'hello world' }],
      });

      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('streamComplete', () => {
    it('should return an Observable (MVP stub)', () => {
      const provider = new OpenAIProvider('gpt-4o', 'sk-test', 1000);

      const stream = provider.streamComplete({ messages: [] });

      expect(stream).toBeInstanceOf(Observable);
    });
  });
});
