# ai-observability Specification

> **Change**: EPIC-008 | **Type**: New | **Dependencies**: All AI specs (metrics collected across the pipeline)

## Purpose

Capture per-request AI metrics and publish domain events for every AI interaction. Integrates with the existing `DomainEventDispatcher` pattern. Per RFC-009 §9.

## Requirements

| #   | Requirement                                     | Strength |
| --- | ----------------------------------------------- | -------- |
| R1  | Per-request metrics recording                   | MUST     |
| R2  | Domain events (4 types)                         | MUST     |
| R3  | Event payload structure                         | MUST     |
| R4  | Integration with existing DomainEventDispatcher | MUST     |

### Requirement: Per-Request Metrics Recording

The `AIObserver` service SHALL record the following metrics per AI request:

| Metric               | Type    | Source                                    |
| -------------------- | ------- | ----------------------------------------- |
| `request_id`         | uuid    | generated at request start                |
| `capability`         | string  | capability.id                             |
| `provider`           | string  | provider.id                               |
| `model`              | string  | selected model                            |
| `latency_ms`         | number  | elapsed from request start to final chunk |
| `ttft_ms`            | number  | elapsed to first token                    |
| `prompt_tokens`      | number  | from provider response                    |
| `completion_tokens`  | number  | from provider response                    |
| `total_tokens`       | number  | prompt + completion                       |
| `estimated_cost_usd` | number  | from provider.estimateCost()              |
| `success`            | boolean | true unless error/cancelled               |
| `error_type`         | string? | classified error code if failed           |
| `user_id`            | string  | authenticated user                        |
| `truncated`          | boolean | from context assembler                    |
| `cache_hit`          | boolean | from context assembler                    |

#### Scenario: Successful request records all metrics

- GIVEN a completed AI request for `explain-module`
- WHEN `AIObserver.recordCompleted(requestId)` is called
- THEN all 15 metrics are populated
- AND `success: true`, `error_type: null`

### Requirement: Domain Events

The system SHALL publish four AI domain events via the existing `InMemoryDomainEventDispatcher`:

| Event                | Trigger                                  |
| -------------------- | ---------------------------------------- |
| `AIRequestStarted`   | Request enters the orchestrator pipeline |
| `AIRequestCompleted` | Request succeeds (final token streamed)  |
| `AIRequestFailed`    | Request fails after retries exhausted    |
| `AIRequestCancelled` | User closes SSE connection mid-stream    |

#### Scenario: Event lifecycle for a successful request

- GIVEN a valid AI request
- WHEN the orchestrator pipeline runs
- THEN `AIRequestStarted` fires first
- AND after completion, `AIRequestCompleted` fires
- AND `AIRequestFailed` and `AIRequestCancelled` do NOT fire

### Requirement: Event Payload Structure

Every AI event SHALL carry: `eventId` (uuid), `requestId` (uuid, links events to a single request), `capability` (string), `userId` (string), `repositoryId` (string), `timestamp` (ISO 8601). `AIRequestCompleted` SHALL additionally carry: `provider`, `model`, `latencyMs`, `ttftMs`, `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCostUsd`, `truncated`, `cacheHit`.

#### Scenario: AIRequestCompleted payload is complete

- GIVEN a successful streaming response finishing in 2500ms
- WHEN `AIRequestCompleted` is dispatched
- THEN the event payload includes all required fields and all completion-specific fields

### Requirement: Integration with DomainEventDispatcher

AI event handlers SHALL be registered in `AiModule.onModuleInit()` by injecting `InMemoryDomainEventDispatcher` and calling `registerHandler(eventType, handler)`. The existing dispatcher pattern (used by `analysis`, `knowledge-graph`) MUST be followed — no new event infrastructure.

#### Scenario: Outdated cache invalidation on KG update

- GIVEN an event handler registered for `KnowledgeGraphUpdated`
- WHEN the event fires
- THEN the handler clears Redis context cache keys for the affected repository
- AND `AIRequestCompleted` is NOT directly coupled to cache invalidation

> **Cross-reference**: Deferred: aggregated metrics dashboards, Prometheus integration. Per RFC-009 §9.2, aggregated metrics are explicit non-MVP.
