# Apply Progress: ai-enrichment — PR 1 (KG Foundation, Gap G1)

Branch: `feat/ai-enrichment` (base: `main` → feature-branch-chain PR #1)
Artifact store: openspec | Strict TDD: RED → GREEN per task
Scope: Phase 1 only — tasks 1.1, 1.2, 1.3. Phases 2-5 belong to later PRs.

## TDD Cycle Evidence

| Task | Test File                                                                            | Layer | RED     | GREEN | Notes                                        |
| ---- | ------------------------------------------------------------------------------------ | ----- | ------- | ----- | -------------------------------------------- |
| 1.1  | `graph-node.vo.spec.ts`                                                              | Unit  | Written | 21/21 | create/reconstitute/toJSON/equality coverage |
| 1.2  | `typeorm-entities.spec.ts`                                                           | Unit  | n/a     | 18/18 | column metadata + snake_case assertions      |
| 1.3  | `graph.builder.spec.ts` + `graph.repository.spec.ts` + `graph-query.service.spec.ts` | Unit  | Written | 54/54 | propagation, persistence round-trip, query   |

## Test Summary

- `npx jest` (full backend): 63 suites, 509 tests, 0 failures
- `npx tsc --noEmit`: 0 errors
- Layers: Unit (all three tasks)

## Files Changed

| File                                                                                                      | Action | Description                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/backend/src/modules/knowledge-graph/domain/graph-node.vo.ts`                                         | Modify | Add `sourceFile: string \| null` to constructor, create/reconstitute (default null), toJSON, equality components |
| `src/backend/src/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity.ts` | Modify | Add `source_file TEXT NULL` column                                                                               |
| `src/backend/src/shared/infrastructure/persistence/migrations/1786147200000-AddSourceFileToGraphNodes.ts` | Create | `ALTER TABLE graph_nodes ADD COLUMN source_file TEXT NULL` (down: DROP COLUMN)                                   |
| `src/backend/src/modules/knowledge-graph/application/graph.builder.ts`                                    | Modify | Propagate `semanticNode.sourceFile` → `GraphNode.sourceFile`; deprecated copies carry sourceFile                 |
| `src/backend/src/modules/knowledge-graph/infrastructure/persistence/repositories/graph.repository.ts`     | Modify | Map `node.sourceFile` ↔ `entity.source_file` in both directions                                                  |
| `src/backend/src/modules/knowledge-graph/application/graph-query.service.ts`                              | Modify | Add `getNodesByFile` static helper                                                                               |
| 4 test files                                                                                              | Modify | New RED→GREEN tests + column metadata assertions                                                                 |

## Deviations / Decisions

- **Kept `properties.filePath` merge** in `graph.builder.ts` alongside the new dedicated `source_file` column. Rationale: frontend `src/frontend/src/components/graph/canvas/filter.ts` derives architectural layers from `properties.filePath`; spec REQ-KG-001 requires backward compatibility. The dedicated column is additive; `properties.filePath` stays for the current frontend contract.
- `sourceFile` param defaults to `null` in create/reconstitute — old snapshots hydrate as `null` (spec "Old snapshot has null sourceFile" scenario).
- Migration follows the existing `src/shared/infrastructure/persistence/migrations/` convention (timestamped file; `synchronize` handles dev schema, migration covers prod).

## Next PRs (out of scope here)

PR 2: AI domain + config + provider abstraction. PR 3: context assembly + prompts. PR 4: pipeline, gates, KG merge, RFC-009.

---

# Apply Progress: ai-enrichment — PR 2 (AI Domain + Config + Provider Abstraction)

Branch: `feat/ai-enrichment` (accumulates on tracker; feature-branch-chain PR #2)
Artifact store: openspec | Strict TDD: RED → GREEN per task
Scope: Phase 2 (tasks 2.1-2.5) + Phase 3 (tasks 3.1-3.4). Phases 4-5 belong to PR 3/4.

## TDD Cycle Evidence

| Task | Test File                                                            | Layer | RED     | GREEN | Notes                                                  |
| ---- | -------------------------------------------------------------------- | ----- | ------- | ----- | ------------------------------------------------------ |
| 2.1  | `unit/configuration.spec.ts` (AiConfig block)                        | Unit  | Written | 19/19 | defaults + env overrides for all ai.* fields           |
| 2.2  | `ai-provider.interface.spec.ts` + `ai-request.vo.spec.ts`            | Unit  | Written | 11/11 | 5-method contract, VO shapes, enrichment contracts     |
| 2.3  | `ai-errors.spec.ts`                                                  | Unit  | Written | 7/7   | BaseAIError fields + 6 typed errors retriability       |
| 2.4  | `ai-enrichment.entity.spec.ts` + `code-sketch.vo.spec.ts`            | Unit  | Written | 8/8   | create/reconstitute/toJSON, sketch fields + truncation |
| 2.5  | `ai-events.spec.ts` + `ai.module.spec.ts` (scaffold)                 | Unit  | Written | 8/8   | 4 events, queue tokens, BullMQ registration            |
| 3.1  | `openai.provider.spec.ts`                                            | Unit  | Written | 11/11 | SDK mapping, 429→AIRateLimit, enrich schema guard      |
| 3.2  | `ollama.provider.spec.ts`                                            | Unit  | Written | 11/11 | /api/generate + /api/tags, JSON format, error mapping  |
| 3.3  | `mock.provider.spec.ts`                                              | Unit  | Written | 7/7   | fixture lookup, no network, health always true         |
| 3.4  | `provider-selector.service.spec.ts` + `ai.module.spec.ts` (registry) | Unit  | Written | 9/9   | default select, fallback, none-healthy throws          |

## Test Summary

- `npx jest` (full backend): 74 suites, 588 tests, 0 failures (was 63/509 at PR 1 → +79 new AI tests)
- `npx tsc --noEmit`: 0 errors
- Layers: Unit only (all tasks; no integration/E2E — pipeline lives in PR 4)

## Files Changed (PR 2)

| File                                                                             | Action | Description                                                                                      |
| -------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `src/backend/src/config/configuration.ts`                                        | Modify | Add `AIProviderConfig` + `AiConfig` interfaces and `ai:` section to `AppConfiguration` factory   |
| `src/backend/src/config/config.service.ts`                                       | Modify | Add `get ai(): AiConfig` getter                                                                  |
| `src/backend/.env.example`                                                       | Modify | Add `AI_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `AI_*`    |
| `src/backend/src/modules/ai/domain/ai-provider.interface.ts`                     | Create | `AIProvider` — complete, streamComplete, healthCheck, estimateCost, enrich                       |
| `src/backend/src/modules/ai/domain/ai-request.vo.ts`                             | Create | `AIRequest`, `AIResponse`, `AIChunk`, `AIEnrichmentRequest`, `AIEnrichmentResponse`, `AIMessage` |
| `src/backend/src/modules/ai/domain/ai-errors.ts`                                 | Create | `BaseAIError` + 6 typed errors with provider_id/model/timestamp/retriable                        |
| `src/backend/src/modules/ai/domain/ai-enrichment.entity.ts`                      | Create | `IrEnrichment` aggregate + `AIClassifiedRole` + `AIDtoField`                                     |
| `src/backend/src/modules/ai/domain/code-sketch.vo.ts`                            | Create | `CodeSketch`, `MethodSketch`, `ParamSketch` + `omittedMethodCount`                               |
| `src/backend/src/modules/ai/domain/ai-events.ts`                                 | Create | `EnrichmentStarted/Completed/Failed/SkippedEvent`                                                |
| `src/backend/src/modules/ai/domain/index.ts`                                     | Create | Domain barrel export                                                                             |
| `src/backend/src/modules/ai/ai.tokens.ts`                                        | Create | `AI_ENRICHMENT_QUEUE`, `AI_ENRICHMENT_DLQ`, `AI_PROVIDER_REGISTRY`                               |
| `src/backend/src/modules/ai/ai.module.ts`                                        | Create | Queue registration + provider factories + `AI_PROVIDER_REGISTRY` + selector export               |
| `src/backend/src/modules/ai/application/provider-selector.service.ts`            | Create | `default_model` resolution + first-healthy fallback                                              |
| `src/backend/src/modules/ai/infrastructure/openai.provider.ts`                   | Create | `openai` SDK adapter (`chat.completions.create`)                                                 |
| `src/backend/src/modules/ai/infrastructure/ollama.provider.ts`                   | Create | fetch `/api/generate` + `/api/tags` health check                                                 |
| `src/backend/src/modules/ai/infrastructure/mock.provider.ts`                     | Create | deterministic fixtures keyed by capability + manifestSha256                                      |
| `src/backend/src/modules/ai/ai.fixtures/classify-lifecycle/abc123.response.json` | Create | Golden fixture for MockProvider enrich                                                           |
| `src/backend/package.json` + `pnpm-lock.yaml`                                    | Modify | Add `openai@^6.49.0`                                                                             |
| 9 test files (new) + configuration.spec.ts (extended)                            | Modify | RED→GREEN specs per task                                                                         |

## Deviations / Decisions

- **`openai@^6` not `openai@7`**: v7 requires Node ≥ 22, but CI pins Node 20 (`.github/workflows/*.yml`). v6 has no engine restriction and the same `chat.completions.create` API. Installed via `pnpm add --filter devlens-backend` (repo is a pnpm workspace; `npm install` breaks ts-jest prepare).
- **`streamComplete` is an MVP stub** returning `EMPTY` observable in all three providers — interface present per REQ-AP-001, streaming deferred.
- **Error mapping without SDK error-type coupling**: OpenAI adapter inspects `(error as {status}).status` (429 → `AIRateLimitError`, else `ProviderUnavailableError`); Ollama adapter inspects `response.status`. `AIDidNotMeetSchemaError` is used by OpenAI.enrich for missing required fields; Ollama.enrich uses `AIInvalidResponseError` for the same (schema gate is Phase 4/5 `ThreeGatesValidator` — adapters do only shape validation).
- **`providers` config defaults populated from env** (openai/ollama/mock) rather than literal `{}` — matches the REQ-AP-004 scenario table while keeping the system runnable out of the box (ollama = local default, mock = CI).
- **`MockProvider.fixturesDir` is `@Optional()`** so Nest DI resolves it (String param otherwise unresolvable); default resolves relative to `__dirname` (works under ts-jest; dist path note in `ai.fixtures` packaging is a PR 4 concern).
- **AiModule does NOT wire `app.module.ts` or event handler** — those are task 5.6/5.4 (PR 4). Module is importable and self-contained now.

## Next PRs (out of scope here)

PR 3: context assembly + prompt management (needs Phase 2 types). PR 4: pipeline, gates, KG merge, RFC-009, app.module wiring.
