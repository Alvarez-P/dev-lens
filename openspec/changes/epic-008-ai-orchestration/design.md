# Design: EPIC-008 — AI Orchestration Platform

## Technical Approach

Platform-first: build the `ai` bounded context as a DDD module (`modules/ai/{domain,application,infrastructure}/`) following the existing `analysis`/`knowledge-graph` patterns. A singleton `AIService` orchestrates a fixed pipeline: route → assemble context → build prompt → stream via provider → observe. OpenAI (SDK), Ollama (fetch), and mock providers implement a common `AIProvider` interface. SSE streaming via NestJS `@Sse()` + RxJS `Observable`. Frontend AI panel attaches to `graph-detail-panel.tsx` with a streaming `fetch` client.

## Architecture Decisions

| Decision              | Choice                              | Alternatives                     | Rationale                                                                                                                    |
| --------------------- | ----------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Provider SDK**      | `openai` npm package                | fetch-based adapter              | Native streaming + typed responses; only new dep (RFC-010 §6.2). Ollama uses fetch (no maintained SDK).                      |
| **Streaming**         | NestJS `@Sse()` + RxJS `Observable` | WebSocket (`@nestjs/websockets`) | `@Sse()` ships with `@nestjs/platform-express` already installed; zero new deps. WS deferred for conversations.              |
| **Token counting**    | ~4 chars/token heuristic            | tiktoken (WASM dep)              | tiktoken adds build complexity; heuristic sufficient for budget enforcement. Upgrade when precision matters.                 |
| **Output validation** | `class-validator` DTOs              | zod, ajv, JSONSchema             | Zero new deps; matches existing `graph-query.dto.ts` pattern; `ValidationPipe` already global. JSONSchema deferred.          |
| **Metric storage**    | TypeORM `AiRequest` entity          | Event-sourcing only              | Follows existing persistence pattern (analysis, knowledge-graph); `AIObserver` ALSO dispatches 4 domain events.              |
| **AI config**         | `ai:` section in `configuration.ts` | Separate module config           | Mirrors `analysis:` section pattern; `ConfigService` typed accessor. API keys via `.env` (MVP; RFC-009 §14 deviation noted). |

## Data Flow

```
POST /api/v1/ai/stream  { capability, targetNodeFqn, query? }
│
▼ AiController
│
▼ AIService (orchestrator)
│  1. ProviderRouter: select provider by capability requirements + health + cost
│  2. ContextAssembler: GraphQueryService.getNodeWithEdges() → truncate → Redis cache
│  3. PromptBuilder: load versioned templates → variable substitution → token budget check
│  4. AIProvider.streamComplete(prompt) → Observable<AIChunk>
│  5. @Sse() → SSE text/event-stream → Frontend ReadableStream
│  6. AIObserver: record AiRequest entity + dispatch AIRequestStarted/Completed/Failed/Cancelled
│
▼ Chunk contract: { type: "token"|"done"|"error", content: string }
```

## File Changes

| File                                                                       | Action | Description                                                                                      |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `src/backend/src/modules/ai/ai.module.ts`                                  | Create | Module registration, queue setup, onModuleInit event handlers                                    |
| `src/backend/src/modules/ai/ai.tokens.ts`                                  | Create | AI_PROVIDER_REGISTRY, CAPABILITY_REGISTRY, AI_QUEUE, AI_DLQ tokens                               |
| `src/backend/src/modules/ai/domain/ai-provider.interface.ts`               | Create | AIProvider interface: complete, streamComplete, healthCheck, estimateCost                        |
| `src/backend/src/modules/ai/domain/ai-capability.ts`                       | Create | AICapability entity: id, version, contextStrategy, promptTemplate, outputFormat, validationRules |
| `src/backend/src/modules/ai/domain/ai-errors.ts`                           | Create | ProviderUnavailable, ContextBudgetExceeded, PromptBudgetExceeded, AIDidNotMeetSchema             |
| `src/backend/src/modules/ai/domain/ai-events.ts`                           | Create | AIRequestStarted/Completed/Failed/Cancelled implementing DomainEvent                             |
| `src/backend/src/modules/ai/application/ai.service.ts`                     | Create | Singleton orchestrator: pipeline composition per RFC-009 §5.2                                    |
| `src/backend/src/modules/ai/application/capability-registry.service.ts`    | Create | In-memory registry: register, get, list, isAvailable                                             |
| `src/backend/src/modules/ai/application/context-assembler.service.ts`      | Create | KG queries, truncation (direct-first), Redis cache, file allow/deny-list                         |
| `src/backend/src/modules/ai/application/prompt-builder.service.ts`         | Create | Template loader, variable substitution, token budget ≤6000, injection defenses                   |
| `src/backend/src/modules/ai/application/provider-router.service.ts`        | Create | Selection by capability match + health + cost; fallback on retriable errors                      |
| `src/backend/src/modules/ai/application/ai-observer.service.ts`            | Create | Persist AiRequest entity + dispatch 4 domain events                                              |
| `src/backend/src/modules/ai/infrastructure/providers/openai.provider.ts`   | Create | OpenAI SDK adapter: chat.completions.create + stream                                             |
| `src/backend/src/modules/ai/infrastructure/providers/ollama.provider.ts`   | Create | Fetch-based adapter: /api/generate + /api/tags                                                   |
| `src/backend/src/modules/ai/infrastructure/providers/mock.provider.ts`     | Create | Deterministic responses keyed by capability+seed; zero network                                   |
| `src/backend/src/modules/ai/infrastructure/controllers/ai.controller.ts`   | Create | `@Sse('stream')` endpoint, POST body → Observable<MessageEvent>                                  |
| `src/backend/src/modules/ai/infrastructure/cache/context-cache.service.ts` | Create | ioredis: `context:{cap}:{nodeId}:{depth}`, TTL 5m, invalidation on KG update                     |
| `src/backend/src/config/configuration.ts`                                  | Modify | Add `AIConfig` interface + `ai` section (providers, enabled, defaultModel)                       |
| `src/backend/src/config/config.service.ts`                                 | Modify | Add `ai` getter                                                                                  |
| `src/backend/src/app.module.ts`                                            | Modify | Import `AiModule`                                                                                |
| `src/frontend/src/lib/api-client.ts`                                       | Modify | Add `stream()`: POST + ReadableStream, timeout 0, reuse `combineAbortSignals`                    |
| `src/frontend/src/components/graph/graph-detail-panel.tsx`                 | Modify | AI panel section: loading/streaming/error states, cancel button                                  |
| `src/frontend/src/lib/store/ai-store.ts`                                   | Create | Zustand slice: chunks[], status (idle                                                            | streaming | done | error), appendChunk, reset |

## Interfaces / Contracts

```typescript
// AIProvider (domain/ai-provider.interface.ts)
interface AIProvider {
  id: string;
  name: string;
  supportedModels: string[];
  complete(req: AIRequest): Promise<AIResponse>;
  streamComplete(req: AIRequest): Observable<AIChunk>;
  healthCheck(): Promise<boolean>;
  estimateCost(req: AIRequest): number;
}

// AICapability (domain/ai-capability.ts)
interface AICapability {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
  contextStrategy: {
    targetNodeType;
    relationshipDepth;
    includeDependents;
    includeDependencies;
    includeApiSurface;
    maxContextTokens;
  };
  promptTemplate: { systemInstruction; contextPlaceholder; capabilityInstructions };
  outputFormat: { type: 'text' | 'markdown' | 'json'; dto?: ClassConstructor };
  validationRules: ValidationRule[];
}

// SSE chunk contract
type AIChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; content: { tokens: number; cost: number; model: string } }
  | { type: 'error'; content: { code: string; message: string } };
```

## Testing Strategy

| Layer       | What to Test                                                                                                    | Approach                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Unit        | AIProvider impls, CapabilityRegistry, PromptBuilder (template + budget), truncation algorithm, validation rules | Jest: mock GraphQueryService, inject mock provider  |
| Integration | End-to-end pipeline with mock provider, SSE chunk contract, Redis cache hit/miss, error → fallback              | Jest + supertest: @Sse() endpoint + mock AIProvider |
| E2E         | Frontend streaming panel: token rendering, cancel mid-stream, error display                                     | Playwright: mock SSE endpoint with fixture data     |

## Migration / Rollout

No migration required. Additive module. Disable via `ai.enabled=false`; feature-flag AI panel. `sourceFile` column on graph nodes is additive — `nullable`, default `null`, no destructive migration.

## Open Questions

- [ ] `request-flow-visualization` in-flight change modifies same KG enums; sequence before or after EPIC-008?
- [ ] tiktoken vs heuristic — acceptable precision for MVP token budget?
- [ ] SSE + global `response-transform.interceptor` — does interceptor buffer? Verify early.
