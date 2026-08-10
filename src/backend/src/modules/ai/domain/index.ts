export {
  AIMessage,
  AIMessageRole,
  TokenUsage,
  AIRequest,
  AIResponse,
  AIChunk,
  AIChunkType,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
} from './ai-request.vo';

export { AIProvider } from './ai-provider.interface';

export { CapabilityRegistry } from './capability-registry.interface';

export {
  AICapability,
  AICapabilityInput,
  AICapabilityTier,
  AI_CAPABILITY_TIERS,
  createCapability,
} from './ai-capability';

export {
  ContextStrategy,
  ContextStrategyInput,
  createContextStrategy,
  DEFAULT_CONTEXT_MAX_TOKENS,
} from './context-strategy';

export {
  PromptTemplate,
  PromptTemplateInput,
  PromptExample,
  createPromptTemplate,
} from './prompt-template';

export {
  OutputFormat,
  OutputFormatInput,
  OutputFormatType,
  createOutputFormat,
} from './output/output-format';

export {
  ValidationRule,
  ValidationRuleKind,
  ValidationResult,
  ValidationViolation,
  CompletenessRule,
  SchemaRule,
  LengthRule,
  SafetyRule,
  GroundednessRule,
  runValidation,
} from './output/validation-rule';

export {
  LifecycleEnrichmentDto,
  ClassRoleDto,
  DtoFieldDto,
  AI_ROLE_ENUM,
} from './output/lifecycle-enrichment.dto';

export {
  AIDtoField,
  AIClassifiedRole,
  FailedUnit,
  IrEnrichment,
  IrEnrichmentId,
  IrEnrichmentJson,
  IrEnrichmentProps,
} from './ai-enrichment.entity';

export { CodeSketch, MethodSketch, ParamSketch } from './code-sketch.vo';

export {
  BaseAIError,
  ProviderUnavailableError,
  ContextBudgetExceededError,
  AIDidNotMeetSchemaError,
  AIRateLimitError,
  AIAuthenticationError,
  AIInvalidResponseError,
  AISecretsExposureError,
  CapabilityNotFoundError,
  DuplicateCapabilityError,
} from './ai-errors';

export {
  EnrichmentStartedEvent,
  EnrichmentCompletedEvent,
  EnrichmentFailedEvent,
  EnrichmentSkippedEvent,
} from './ai-events';
