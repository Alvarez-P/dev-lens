# ai-provider-abstraction Specification

> **Change**: ai-enrichment (2026-08-06) | **Capability**: New

## Purpose

Define the `AIProvider` interface, request/response contracts, provider adapters (OpenAI, Ollama, Mock), error taxonomy, and configuration. This is the foundational abstraction enabling all AI capabilities — per RFC-010 §6, providers are pluggable behind a common interface with config-driven selection.

## Requirements

### Requirement: AIProvider Interface Contract

The system SHALL define an `AIProvider` interface with five methods:

| Method           | Signature                                                     | Purpose                                                             |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `complete`       | `(req: AIRequest) => Promise<AIResponse>`                     | Send prompt, receive full response                                  |
| `streamComplete` | `(req: AIRequest) => Observable<AIChunk>`                     | Send prompt, receive token stream (MVP deferred, interface present) |
| `healthCheck`    | `() => Promise<boolean>`                                      | Verify provider connectivity                                        |
| `estimateCost`   | `(req: AIRequest) => number`                                  | Pre-flight token cost estimate                                      |
| `enrich`         | `(req: AIEnrichmentRequest) => Promise<AIEnrichmentResponse>` | Batch enrichment for pipeline use                                   |

All methods SHALL propagate provider-native errors wrapped as typed `AIError` subtypes. The interface MUST be the single contract that every provider adapter implements — no direct provider SDK usage outside infrastructure adapters.

#### Scenario: Provider adapter satisfies interface

- GIVEN a registered provider adapter implementing `AIProvider`
- WHEN the enrichment pipeline calls `provider.enrich(request)`
- THEN the adapter translates to provider-native API, deserializes the response, and returns a validated `AIEnrichmentResponse`
- AND typed errors are wrapped in `ProviderUnavailableError` or `AIDidNotMeetSchemaError` as appropriate

#### Scenario: Provider swap requires zero upstream changes

- GIVEN `ai.providers.default_model` is changed from `openai/gpt-4o` to `ollama/codellama`
- WHEN the enrichment pipeline resolves the configured provider
- THEN the pipeline code calls the same `AIProvider` interface with no changes
- AND the Ollama adapter handles the fetch-based protocol internally

### Requirement: AIRequest and AIResponse Contracts

The system SHALL define:

- `AIRequest`: `{ messages: AIMessage[]; model?: string; maxTokens?: number; temperature?: number; responseFormat?: 'text' | 'json_object' }`
- `AIResponse`: `{ content: string; model: string; tokensUsed: { input: number; output: number }; finishReason: string }`
- `AIChunk`: `{ type: 'token' | 'done' | 'error'; content: string; tokens?: number; cost?: number; model?: string }`
- `AIEnrichmentRequest`: extends `AIRequest` with `{ capability: string; framework: string; manifestSha256: string }`
- `AIEnrichmentResponse`: `{ framework: string; architecture: string; confidence: number; classes: AIClassifiedRole[] }`

#### Scenario: Request carries provider-agnostic payload

- GIVEN an enrichment request for a NestJS module
- WHEN the request is passed to `provider.enrich()`
- THEN the `messages` array contains system, context, and user prompts serialized as provider-agnostic `AIMessage` objects
- AND the adapter translates to provider-native format internally

#### Scenario: Response includes token accounting

- GIVEN a successful completion
- WHEN `AIResponse` is returned
- THEN `tokensUsed.input` and `tokensUsed.output` are populated
- AND `finishReason` is `stop` (complete) or `length` (truncated)

### Requirement: Provider Implementations

The system SHALL provide three `AIProvider` implementations:

| Provider         | Adapter                                                        | Config                            |
| ---------------- | -------------------------------------------------------------- | --------------------------------- |
| `OpenAIProvider` | `openai` npm SDK (`chat.completions.create`)                   | `OPENAI_API_KEY`, `OPENAI_MODEL`  |
| `OllamaProvider` | `fetch`-based (`/api/generate`, `/api/tags`)                   | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |
| `MockProvider`   | Deterministic responses keyed by `capability + manifestSha256` | No network, no keys               |

`MockProvider` SHALL return fixed, versioned-filesystem fixtures for CI. `OllamaProvider` SHALL be the default for local development. All three MUST be registered in `AiModule.providers` with `@Injectable()` and token-based injection (`AI_PROVIDER_REGISTRY`).

#### Scenario: MockProvider returns deterministic fixture

- GIVEN `ai.providers.mock` is configured and `AI_PROVIDER_REGISTRY` resolves `MockProvider`
- WHEN `provider.enrich()` is called with `manifestSha256 = 'abc123'` and `capability = 'classify-lifecycle'`
- THEN the response matches `ai/fixtures/classify-lifecycle/abc123.response.json` exactly
- AND no network request is made

#### Scenario: OllamaProvider health check

- GIVEN `OLLAMA_BASE_URL` is set to a running Ollama instance
- WHEN `provider.healthCheck()` is called
- THEN a `GET /api/tags` request succeeds with HTTP 200
- AND the method returns `true`

### Requirement: AI Configuration Section

The system SHALL expose an `ai` configuration section in `configuration.ts` with the following fields:

| Field                     | Type                               | Default           | Description                            |
| ------------------------- | ---------------------------------- | ----------------- | -------------------------------------- |
| `enabled`                 | `boolean`                          | `false`           | Master kill-switch for all AI features |
| `providers`               | `Record<string, AIProviderConfig>` | `{}`              | Provider configs keyed by name         |
| `default_model`           | `string`                           | `ollama/llama3.2` | Default provider/model selector        |
| `timeout_ms`              | `number`                           | `60000`           | Per-request timeout in ms              |
| `retry.max_attempts`      | `number`                           | `2`               | Max LLM call attempts (incl. retry)    |
| `budget.max_total_tokens` | `number`                           | `6000`            | Hard token budget per prompt           |

Provider config SHALL include: `api_key_env` (env var name), `base_url`, `model`, `enabled`. API keys MUST be loaded from environment variables, never hardcoded.

#### Scenario: AI disabled skips enrichment

- GIVEN `ai.enabled = false`
- WHEN the enrichment worker receives an `analysis.completed` event
- THEN no job is enqueued
- AND the deterministic pipeline proceeds unchanged

#### Scenario: Missing API key blocks provider init

- GIVEN `ai.providers.openai.api_key_env = 'OPENAI_API_KEY'` but `OPENAI_API_KEY` is not set
- WHEN `OpenAIProvider` is instantiated
- THEN the provider logs a warning and `healthCheck()` returns `false`
- AND enrichment falls back to the next available provider or deterministic fallback

### Requirement: Error Taxonomy

The system SHALL define typed domain errors extending `BaseAIError`:

| Error                        | Trigger                                             | Retriable        |
| ---------------------------- | --------------------------------------------------- | ---------------- |
| `ProviderUnavailableError`   | Network failure, timeout, 5xx from provider         | Yes              |
| `ContextBudgetExceededError` | Assembled context exceeds `budget.max_total_tokens` | No               |
| `AIDidNotMeetSchemaError`    | LLM response fails class-validator schema           | Yes (once)       |
| `AIRateLimitError`           | Provider returns 429                                | Yes (backoff)    |
| `AIInvalidResponseError`     | Malformed JSON, empty response, parse failure       | Yes (once)       |
| `AISecretsExposureError`     | Potential secret detected in sketch payload         | No (blocks send) |

All errors SHALL carry `provider_id`, `model`, and `timestamp`.

#### Scenario: Rate limit triggers backoff retry

- GIVEN a provider returns HTTP 429
- WHEN the adapter catches it
- THEN `AIRateLimitError` is thrown with `retriable = true`
- AND the enrichment worker retries after exponential backoff

#### Scenario: Schema failure retries with feedback

- GIVEN LLM output fails `class-validator` schema validation
- WHEN `AIDidNotMeetSchemaError` is thrown with validation errors
- THEN the enrichment worker retries once, appending the error message to the prompt
- AND on second failure, falls back to deterministic classification for that unit

### Requirement: Provider Selection by Config

`ProviderSelectorService` SHALL resolve the active provider from `ai.providers` by matching `ai.default_model` (`provider/model` format). If the resolved provider is unavailable (`healthCheck() === false`), the selector SHALL fall back to the first available provider. This logic MUST be transparent to consumers — they always call `AIProvider.enrich()`.

#### Scenario: Default provider selected

- GIVEN `ai.default_model = 'openai/gpt-4o'` and OpenAI is healthy
- WHEN `ProviderSelectorService.getProvider()` is called
- THEN `OpenAIProvider` is returned

#### Scenario: Fallback when default is unhealthy

- GIVEN `ai.default_model = 'openai/gpt-4o'` but `OpenAIProvider.healthCheck()` returns `false`
- WHEN `ProviderSelectorService.getProvider()` is called
- THEN the first healthy provider is returned (e.g., `OllamaProvider`)
- AND a warning is logged with the fallback reason
