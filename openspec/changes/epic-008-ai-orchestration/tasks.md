# Tasks: EPIC-008 — AI Orchestration Platform

## Review Workload Forecast

Estimated ~5,200 changed lines across 16 stacked PRs (avg ~320/PR). Every unit ships tests with code (config `tdd: true`).

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units (merge order PR1→16, each to main)

| Unit | Goal                        | PR   | Deps  | Lines |
| ---- | --------------------------- | ---- | ----- | ----- |
| 1    | Provider contracts          | PR1  | —     | 360   |
| 2    | Capability model            | PR2  | 1     | 360   |
| 3    | KG sourceFile delta         | PR3  | —     | 200   |
| 4    | `ai:` config                | PR4  | —     | 200   |
| 5    | OpenAI provider             | PR5  | 1,4   | 330   |
| 6    | Ollama + Mock               | PR6  | 1,4   | 360   |
| 7    | Redis context cache         | PR7  | 1     | 240   |
| 8    | CapabilityRegistry + Router | PR8  | 1-7   | 390   |
| 9    | ContextAssembler            | PR9  | 2,3,7 | 420   |
| 10   | PromptBuilder + templates   | PR10 | 2,9   | 340   |
| 11   | AIService orchestrator      | PR11 | 8-10  | 330   |
| 12   | AI events + Observer        | PR12 | 7,11  | 420   |
| 13   | SSE controller              | PR13 | 11,12 | 320   |
| 14   | AiModule wiring             | PR14 | 4-13  | 250   |
| 15   | Frontend stream client      | PR15 | 13    | 290   |
| 16   | AI panel + e2e              | PR16 | 15    | 350   |

## Phase 1: Domain & Foundation (PR1-4)

- [x] 1.1 PR1 `domain/ai-provider.interface.ts` (AIProvider, AIRequest/AIResponse, AIChunk), `ai-errors.ts`, `capability-registry.interface.ts`
- [x] 1.2 PR2 `domain/ai-capability.ts`, `context-strategy.ts`, `prompt-template.ts`, `output/*.dto.ts`
- [x] 1.3 PR3 `graph-node.typeorm-entity.ts`, `graph-node.vo.ts`, `graph.repository.ts`, `semantic-model.builder.ts`: nullable `sourceFile` + migration
- [x] 1.4 PR4 `configuration.ts` AIConfig, `config.service.ts` getter, `.env.example`

## Phase 2: Infrastructure (PR5-7)

- [x] 2.1 PR5 `providers/openai.provider.ts` (complete/streamComplete/healthCheck/estimateCost)
- [x] 2.2 PR6 `providers/ollama.provider.ts` + `mock.provider.ts`
- [x] 2.3 PR7 `cache/context-cache.service.ts` (`context:{cap}:{nodeId}:{depth}`, TTL 5m)

## Phase 3: Application Services (PR8-11)

- [x] 3.1 PR8 `capability-registry.service.ts` (register/get/list/isAvailable)
- [x] 3.2 PR8 `provider-router.service.ts` (capability+health+cost, retry→fallback)
- [x] 3.3 PR9 `context-assembler.service.ts`: KG retrieval, truncation marker, allow/deny-list, cache
- [x] 3.4 PR10 `prompt-builder.service.ts`: substitution, 4-section, ≤6000, injection + templates `ai/capabilities/explain-module/v1/`
- [x] 3.5 PR11 `ai.service.ts`: route→context→prompt→stream→observe

## Phase 4: Transport & Observability (PR12-13)

- [x] 4.1 PR12 `domain/ai-events.ts` (4 events + payloads) + `ai-observer.service.ts` (15 metrics, dispatch, KG-updated cache invalidation)
- [x] 4.2 PR13 `controllers/ai.controller.ts`: `@Sse('stream')`, token/done/error chunks, cancel on close, sanitized errors, no interceptor buffering; supertest e2e

## Phase 5: Module Wiring (PR14)

- [x] 5.1 PR14 `ai.tokens.ts` + `ai.module.ts` + import in `app.module.ts`: providers/services/controller, onModuleInit handlers, register explain-module; mock-provider e2e

## Phase 6: Frontend (PR15-16)

- [x] 6.1 PR15 `lib/store/ai-store.ts` (chunks, status, appendChunk, reset)
- [x] 6.2 PR15 `lib/api-client.ts` `stream()`: POST+ReadableStream, timeout 0, combineAbortSignals
- [x] 6.3 PR16 `graph-detail-panel.tsx` AI panel: progressive tokens, cancel, error states
- [x] 6.4 PR16 Playwright e2e: token render, cancel mid-stream, error display
