# ai-provider-abstraction Specification

> **Change**: EPIC-008 | **Type**: New | **Dependencies**: ai-streaming (streamComplete contract)

## Purpose

Define the provider-agnostic interface, selection logic, configuration-driven setup, and fallback mechanism for AI model providers. Enables switching providers through configuration without code changes.

## Requirements

| #   | Requirement                                          | Strength |
| --- | ---------------------------------------------------- | -------- |
| R1  | AIProvider interface contract                        | MUST     |
| R2  | Provider selection by capability, availability, cost | MUST     |
| R3  | Configuration-driven provider setup                  | MUST     |
| R4  | Provider fallback on failure                         | MUST     |
| R5  | Mock provider for CI                                 | MUST     |

### Requirement: AIProvider Interface Contract

The system MUST define the `AIProvider` interface with: `complete(request)`, `streamComplete(request)`, `healthCheck()`, and `estimateCost(request)`. Every provider implementation SHALL implement all four methods. MVP providers: OpenAI (openai SDK), Ollama (fetch-based), Mock (hardcoded responses).

#### Scenario: New capability invokes provider through interface

- GIVEN a registered provider implementing `AIProvider`
- WHEN `AIService` calls `provider.complete(request)`
- THEN the orchestrator has zero knowledge of which concrete provider executes the request

#### Scenario: Health check detects unavailable provider

- GIVEN Ollama is configured but unreachable
- WHEN `healthCheck()` is called
- THEN it returns `false` and the provider router excludes it from selection

### Requirement: Provider Selection Logic

The `ProviderRouter` service SHALL select a provider based on: (1) capability `requiredCapabilities` matching provider `supportedModels`, (2) provider `healthCheck()` returning true, (3) lowest `estimateCost()` among available providers. If no provider matches, it SHALL return a `ProviderUnavailableError`.

#### Scenario: Capability requires JSON mode selects GPT-4o

- GIVEN a capability with `requiredCapabilities: ["json_mode"]`
- AND OpenAI supports GPT-4o (with JSON mode) and Ollama does not
- WHEN the router selects a provider
- THEN OpenAI is selected regardless of cost

### Requirement: Configuration-Driven Setup

Providers SHALL be defined in the `ai:` YAML config section. Each provider entry MUST specify: `enabled`, `baseUrl`/`apiKeySecret`, `defaultModel`, and `capabilities` list. Providers with `enabled: false` SHALL be excluded at startup.

#### Scenario: Config disables Anthropic

- GIVEN `ai.providers.anthropic.enabled: false`
- WHEN the module initializes
- THEN Anthropic is not registered and never receives requests
- AND OpenAI + Ollama remain active

### Requirement: Provider Fallback

When a provider request fails with a retriable error (timeout, 429, 503), the router SHALL retry on the same provider once, then fall back to the next available provider sorted by cost ascending. Authentication errors (401) SHALL fail immediately without fallback.

#### Scenario: OpenAI timeout triggers Ollama fallback

- GIVEN OpenAI times out after one retry
- AND Ollama health check passes
- WHEN the router processes the failure
- THEN the request is retried on Ollama

### Requirement: Mock Provider for CI

The mock provider SHALL implement `AIProvider` and return deterministic, pre-configured responses keyed by capability ID + seed. It MUST NOT make any network calls. CI pipelines MUST use the mock provider exclusively.

#### Scenario: CI e2e test uses mock provider

- GIVEN `NODE_ENV=test` and mock provider configured
- WHEN an AI capability is invoked
- THEN the response is deterministic and matches the golden fixture for that capability

> **Cross-reference**: ai-streaming specifies the `streamComplete` chunk contract. ai-observability collects per-request metrics from provider calls.
