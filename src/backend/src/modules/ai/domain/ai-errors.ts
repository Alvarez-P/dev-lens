import { DomainError } from '../../../shared/domain/domain-error';

/**
 * Base class for all AI domain errors (REQ-AP-005).
 *
 * Every AI error carries the provider, model, and timestamp so the pipeline
 * can attribute failures precisely. `retriable` drives BullMQ retry policy.
 */
export abstract class BaseAIError extends DomainError {
  public readonly provider_id: string;
  public readonly model: string;
  public readonly timestamp: Date;
  public readonly retriable: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    providerId: string,
    model: string,
    retriable: boolean,
  ) {
    super(message, code, statusCode);
    this.provider_id = providerId;
    this.model = model;
    this.timestamp = new Date();
    this.retriable = retriable;
  }
}

/** Network failure, timeout, or 5xx from the provider. Retriable. */
export class ProviderUnavailableError extends BaseAIError {
  constructor(providerId: string, model: string, message: string) {
    super(message, 'PROVIDER_UNAVAILABLE', 503, providerId, model, true);
  }
}

/** Assembled context exceeds `budget.maxTotalTokens`. Not retriable. */
export class ContextBudgetExceededError extends BaseAIError {
  constructor(providerId: string, model: string, message: string) {
    super(message, 'CONTEXT_BUDGET_EXCEEDED', 422, providerId, model, false);
  }
}

/** LLM response fails class-validator schema. Retriable once. */
export class AIDidNotMeetSchemaError extends BaseAIError {
  constructor(providerId: string, model: string, message: string) {
    super(message, 'AI_DID_NOT_MEET_SCHEMA', 422, providerId, model, true);
  }
}

/** Provider returns HTTP 429. Retriable with backoff. */
export class AIRateLimitError extends BaseAIError {
  constructor(providerId: string, model: string, message: string) {
    super(message, 'AI_RATE_LIMIT', 429, providerId, model, true);
  }
}

/** Malformed JSON, empty response, or parse failure. Retriable once. */
export class AIInvalidResponseError extends BaseAIError {
  constructor(providerId: string, model: string, message: string) {
    super(message, 'AI_INVALID_RESPONSE', 422, providerId, model, true);
  }
}

/** Potential secret detected in sketch payload. Blocks send, not retriable. */
export class AISecretsExposureError extends BaseAIError {
  constructor(providerId: string, model: string, message: string) {
    super(message, 'AI_SECRETS_EXPOSURE', 422, providerId, model, false);
  }
}

/** Lookup of a capability id that was never registered. */
export class CapabilityNotFoundError extends DomainError {
  constructor(public readonly capabilityId: string) {
    super(`AI capability "${capabilityId}" is not registered`, 'CAPABILITY_NOT_FOUND', 404);
  }
}

/** Registration of a capability id that is already registered. */
export class DuplicateCapabilityError extends DomainError {
  constructor(public readonly capabilityId: string) {
    super(`AI capability "${capabilityId}" is already registered`, 'DUPLICATE_CAPABILITY', 409);
  }
}
