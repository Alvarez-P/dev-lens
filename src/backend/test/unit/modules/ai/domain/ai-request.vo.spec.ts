import {
  AIRequest,
  AIResponse,
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
  AIMessage,
  TokenUsage,
} from '@/modules/ai/domain/ai-request.vo';
import { AIClassifiedRole } from '@/modules/ai/domain/ai-enrichment.entity';

describe('AIRequest', () => {
  it('should define a provider-agnostic request with optional model settings', () => {
    const request: AIRequest = {
      messages: [
        { role: 'system', content: 'classify' },
        { role: 'user', content: 'users.controller.ts' },
      ],
      model: 'gpt-4o',
      maxTokens: 6000,
      temperature: 0.2,
      responseFormat: 'json_object',
    };

    expect(request.messages).toHaveLength(2);
    expect(request.messages[0]).toEqual({ role: 'system', content: 'classify' });
    expect(request.model).toBe('gpt-4o');
    expect(request.responseFormat).toBe('json_object');
  });

  it('should allow a minimal request with only messages', () => {
    const request: AIRequest = { messages: [{ role: 'user', content: 'hi' }] };

    expect(request.model).toBeUndefined();
    expect(request.maxTokens).toBeUndefined();
  });

  it('should allow AIMessage roles system, user, assistant', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 's' },
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
    ];

    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant']);
  });
});

describe('AIResponse', () => {
  it('should include content, model, token accounting, and finish reason', () => {
    const tokensUsed: TokenUsage = { input: 120, output: 40 };
    const response: AIResponse = {
      content: '{"framework":"nestjs"}',
      model: 'gpt-4o',
      tokensUsed,
      finishReason: 'stop',
    };

    expect(response.content).toContain('nestjs');
    expect(response.tokensUsed.input).toBe(120);
    expect(response.tokensUsed.output).toBe(40);
    expect(response.finishReason).toBe('stop');
  });

  it('should support truncated responses with finishReason length', () => {
    const response: AIResponse = {
      content: 'partial',
      model: 'llama3.2',
      tokensUsed: { input: 10, output: 5 },
      finishReason: 'length',
    };

    expect(response.finishReason).toBe('length');
  });
});

describe('AIChunk', () => {
  it('should support token, done, and error chunk types', () => {
    const token: AIChunk = { type: 'token', content: '{"fra' };
    const done: AIChunk = { type: 'done', content: '', tokens: 100, cost: 0.001 };
    const error: AIChunk = { type: 'error', content: 'boom', model: 'gpt-4o' };

    expect(token.type).toBe('token');
    expect(done.tokens).toBe(100);
    expect(error.type).toBe('error');
    expect(error.model).toBe('gpt-4o');
  });
});

describe('AIEnrichmentRequest', () => {
  it('should extend AIRequest with capability, framework, and manifest sha256', () => {
    const request: AIEnrichmentRequest = {
      messages: [{ role: 'system', content: 'classify' }],
      capability: 'classify-lifecycle',
      framework: 'nestjs',
      manifestSha256: 'abc123',
    };

    expect(request.capability).toBe('classify-lifecycle');
    expect(request.framework).toBe('nestjs');
    expect(request.manifestSha256).toBe('abc123');
    expect(request.messages).toHaveLength(1);
  });
});

describe('AIEnrichmentResponse', () => {
  it('should include framework, architecture, confidence, and classified roles', () => {
    const classes: AIClassifiedRole[] = [
      {
        fqn: 'acme:core:src/users#UsersController',
        role: 'controller',
        lifecycle: ['handler'],
        dtoFields: [],
        confidence: 0.95,
        sourceFile: 'src/users/users.controller.ts',
      },
    ];
    const response: AIEnrichmentResponse = {
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes,
    };

    expect(response.framework).toBe('nestjs');
    expect(response.architecture).toBe('mvc');
    expect(response.confidence).toBe(0.9);
    expect(response.classes[0].role).toBe('controller');
    expect(response.classes[0].sourceFile).toBe('src/users/users.controller.ts');
  });
});
