import { DomainError } from '@/shared/domain/domain-error';
import {
  BaseAIError,
  ProviderUnavailableError,
  ContextBudgetExceededError,
  AIDidNotMeetSchemaError,
  AIRateLimitError,
  AIInvalidResponseError,
  AISecretsExposureError,
  CapabilityNotFoundError,
  DuplicateCapabilityError,
} from '@/modules/ai/domain/ai-errors';

describe('BaseAIError', () => {
  class ConcreteError extends BaseAIError {
    constructor(providerId: string, model: string, message: string) {
      super(message, 'CONCRETE', 500, providerId, model, true);
    }
  }

  it('should extend DomainError and carry provider_id, model, timestamp, retriable', () => {
    const before = Date.now();
    const error = new ConcreteError('openai', 'gpt-4o', 'boom');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ConcreteError');
    expect(error.code).toBe('CONCRETE');
    expect(error.statusCode).toBe(500);
    expect(error.provider_id).toBe('openai');
    expect(error.model).toBe('gpt-4o');
    expect(error.retriable).toBe(true);
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(error.message).toBe('boom');
  });
});

describe('ProviderUnavailableError', () => {
  it('should be retriable with PROVIDER_UNAVAILABLE code', () => {
    const error = new ProviderUnavailableError('ollama', 'llama3.2', 'network failure');

    expect(error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(error.retriable).toBe(true);
    expect(error.provider_id).toBe('ollama');
    expect(error.model).toBe('llama3.2');
  });
});

describe('ContextBudgetExceededError', () => {
  it('should be non-retriable with CONTEXT_BUDGET_EXCEEDED code', () => {
    const error = new ContextBudgetExceededError('openai', 'gpt-4o', 'budget exceeded');

    expect(error.code).toBe('CONTEXT_BUDGET_EXCEEDED');
    expect(error.retriable).toBe(false);
  });
});

describe('AIDidNotMeetSchemaError', () => {
  it('should be retriable with AI_DID_NOT_MEET_SCHEMA code', () => {
    const error = new AIDidNotMeetSchemaError('openai', 'gpt-4o', 'schema failed');

    expect(error.code).toBe('AI_DID_NOT_MEET_SCHEMA');
    expect(error.retriable).toBe(true);
  });
});

describe('AIRateLimitError', () => {
  it('should be retriable with AI_RATE_LIMIT code', () => {
    const error = new AIRateLimitError('openai', 'gpt-4o', 'rate limited');

    expect(error.code).toBe('AI_RATE_LIMIT');
    expect(error.retriable).toBe(true);
  });
});

describe('AIInvalidResponseError', () => {
  it('should be retriable with AI_INVALID_RESPONSE code', () => {
    const error = new AIInvalidResponseError('openai', 'gpt-4o', 'malformed json');

    expect(error.code).toBe('AI_INVALID_RESPONSE');
    expect(error.retriable).toBe(true);
  });
});

describe('AISecretsExposureError', () => {
  it('should be non-retriable with AI_SECRETS_EXPOSURE code', () => {
    const error = new AISecretsExposureError('openai', 'gpt-4o', 'secret detected');

    expect(error.code).toBe('AI_SECRETS_EXPOSURE');
    expect(error.retriable).toBe(false);
  });
});

describe('CapabilityNotFoundError', () => {
  it('should carry CAPABILITY_NOT_FOUND code with 404 status', () => {
    const error = new CapabilityNotFoundError('explain-module');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('CAPABILITY_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.capabilityId).toBe('explain-module');
    expect(error.message).toContain('explain-module');
  });
});

describe('DuplicateCapabilityError', () => {
  it('should carry DUPLICATE_CAPABILITY code with 409 status', () => {
    const error = new DuplicateCapabilityError('explain-module');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DUPLICATE_CAPABILITY');
    expect(error.statusCode).toBe(409);
    expect(error.capabilityId).toBe('explain-module');
    expect(error.message).toContain('explain-module');
  });
});
