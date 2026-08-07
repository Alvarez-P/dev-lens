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

---

# Apply Progress: ai-enrichment — PR 3 (Context Assembly + Prompt Management)

Branch: `feat/ai-enrichment` (accumulates on tracker; feature-branch-chain PR #3)
Artifact store: openspec | Strict TDD: RED → GREEN per task
Scope: Phase 4 only — tasks 4.1-4.7. Phases 1-3, 5 belong to other PRs.

## TDD Cycle Evidence

| Task | Test File                                                                  | Layer | RED     | GREEN | Notes                                                                                  |
| ---- | -------------------------------------------------------------------------- | ----- | ------- | ----- | -------------------------------------------------------------------------------------- |
| 4.1  | `ir-nodes.signatures.spec.ts` + `typescript-ir-builder.signatures.spec.ts` | Unit  | Written | 16/16 | decorators w/ args, ctor params, structured method params, returnType, FQN imports     |
| 4.2  | `code-sketch.builder.spec.ts`                                              | Unit  | Written | 9/9   | signature-only serialize, private helpers excluded, 4000-token truncation              |
| 4.3  | `source-file-filter.spec.ts`                                               | Unit  | Written | 9/9   | .ts/.tsx/.js/.jsx allow, `.env*` + ignored-dir deny w/ warn, silent skip               |
| 4.4  | `context-assembler.service.spec.ts`                                        | Unit  | Written | 9/9   | KG+IR only (no FS), ≤5000 budget w/ priority truncation, `ai:sketch:{sha256}` cache    |
| 4.5  | `prompt-template-loader.spec.ts` + `real-template-files.spec.ts`           | Unit  | Written | 12/12 | versioned v{n}/ load, latest default, missing-version errors early                     |
| 4.6  | `prompt-builder.service.spec.ts`                                           | Unit  | Written | 15/15 | 4 sections, `<code>` isolation, substitution, 6000 budget + ContextBudgetExceededError |
| 4.7  | `framework-config-loader.spec.ts`                                          | Unit  | Written | 4/4   | nestjs/express configs, generic fallback w/ warn                                       |

## Test Summary

- `npx jest` (full backend): 83 suites, 663 tests, 0 failures (was 74/588 at PR 2 → +9 suites, +75 tests)
- `npx tsc --noEmit`: 0 errors
- `npx eslint` on changed src: 0 errors
- Layers: Unit only (no integration/E2E — pipeline lives in PR 4)

## Files Changed (PR 3)

| File                                                                                             | Action | Description                                                                                                                                           |
| ------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/src/modules/analysis/domain/ir-nodes.ts`                                            | Modify | `IrClass.decorators`/`constructorParams`, `IrMethod.decorators`/`params`/`returnType`, `IrModule.imports`, new `IrParameter` VO + `IrParamProps`      |
| `src/backend/src/modules/analysis/domain/index.ts`                                               | Modify | Export `IrParameter` + `IrParamProps`                                                                                                                 |
| `src/backend/src/modules/analysis/infrastructure/parsers/typescript/typescript-ir-builder.ts`    | Modify | Extract decorator text w/ args, ctor/method params (name/type/decorators), returnType, FQN-resolved deduped imports                                   |
| `src/backend/src/modules/ai/application/code-sketch.builder.ts`                                  | Create | `CodeSketchBuilder` + `serializeSketch` + `estimateTokens` (4 chars/token); 4000-token cap, never mid-method, `omittedMethodCount`                    |
| `src/backend/src/modules/ai/application/source-file-filter.ts`                                   | Create | Allow/deny-list classify + filter with warn+skip (`.env*`, ignored dirs)                                                                              |
| `src/backend/src/modules/ai/application/sketch-cache.ts`                                         | Create | In-memory Map cache keyed `ai:sketch:{sha256}` (Redis-deferred per design)                                                                            |
| `src/backend/src/modules/ai/application/context-assembler.service.ts`                            | Create | `ContextAssembler.assemble(analysisId)`, 5000-token guard, priority truncation (controller > service > dto > other), `KgContext` + `AssembledContext` |
| `src/backend/src/modules/ai/application/prompt-template-loader.service.ts`                       | Create | Versioned `ai/capabilities/{id}/v{n}/` loader, latest-by-default, early missing-version error                                                         |
| `src/backend/src/modules/ai/application/framework-config-loader.service.ts`                      | Create | `ai/frameworks/{framework}.json` loader + generic fallback w/ warn                                                                                    |
| `src/backend/src/modules/ai/application/prompt-builder.service.ts`                               | Create | 4-section prompt, `<code sourceFile>` XML isolation, `{{var}}` substitution (throws unresolved), 6000-token budget (KG → sketches → throw)            |
| `src/backend/src/modules/ai/ai.capabilities/classify-lifecycle/v1/system.md` + `instructions.md` | Create | v1 templates incl. untrusted-`<code>` instruction                                                                                                     |
| `src/backend/src/modules/ai/ai.frameworks/nestjs.json` + `express.json`                          | Create | Framework format configs (decoratorSemantics, lifecycleStageOrder, entryPointPatterns)                                                                |
| `src/backend/src/modules/ai/ai.module.ts`                                                        | Modify | Register CodeSketchBuilder/SourceFileFilter/SketchCache/PromptTemplateLoader/FrameworkConfigLoader/PromptBuilder; export sketch-stage services        |
| 10 new test files + ai.module.spec.ts (extended)                                                 | Modify | RED→GREEN specs per task                                                                                                                              |

## Deviations / Decisions

- **IR `parameters` kept alongside new `params`**: legacy name-only `parameters: string[]` remains (endpoints + existing specs depend on it); new structured `params: IrParamProps[]` carries name/type/decorators per REQ-CA-002.
- **`IrModule.imports` (file-level) not `IrClass.imports`**: imports are per-file, matching one CodeSketch per file; resolved to FQNs (external → bare name) via existing `resolveImportTarget`, deduped, declaration order preserved.
- **`ContextAssembler` NOT registered in AiModule yet**: it needs `AnalysisRepository` + `GraphQueryService` (cross-module); module wiring is task 5.6 (PR 4) alongside the enrichment service. All other Phase 4 services are registered.
- **Template version = exact match**: REQ-PM-001 scenario "missing version errors early" requires requesting a non-existent version to throw, even when lower versions exist (spec scenario 3 wins over "highest ≤ requested").
- **Sketch cache is in-memory Map**: design decision "Redis-deferred" (RFC-009 target). Content-addressed key `ai:sketch:{sha256}` preserved so Redis swap is a drop-in later.
- **`kgContext.architecture` defaults to 'unknown'**: pipeline detection is PR 4 (LLM response); prompt substitution uses caller override via `substitutions`.
- **File filter uses `IGNORED_DIRECTORIES` + `.env*` regex from FileManifestService** — single source of truth for ignored dirs.

## Next PRs (out of scope here)

PR 4: pipeline (EnrichmentService 7 stages), ThreeGatesValidator, KG merge, RFC-009 §14 amend, app.module wiring, AiModule cross-module imports.

---

# Apply Progress: ai-enrichment — PR 4 (Pipeline, Gates, KG Merge, RFC-009) — FINAL

Branch: `feat/ai-enrichment` (accumulates on tracker; feature-branch-chain PR #4 — FINAL)
Artifact store: openspec | Strict TDD: RED → GREEN per task
Scope: Phase 5 only — tasks 5.1-5.8. Wires AiModule into app.module.ts (the integration moment).

## TDD Cycle Evidence

| Task | Test File                                                                                             | Layer            | RED     | GREEN   | Notes                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------- | ------- | ------- | --------------------------------------------------------------------------------------- |
| 5.1  | `enrichment.repository.spec.ts` + `enrichment-typeorm-entity.spec.ts` + `enrichment-artifact.spec.ts` | Unit             | Written | 12/12   | findByAnalysisId idempotency, save round-trip, entity metadata, failedUnits on artifact |
| 5.2  | `three-gates-validator.service.spec.ts`                                                               | Unit             | Written | 9/9     | schema w/ forbidNonWhitelisted, referential drop, 0.7 confidence boundary               |
| 5.3  | `enrichment.service.spec.ts`                                                                          | Unit             | Written | 8/8     | 7 stages, schema retry once, manifest idempotency, provider-down, partial success       |
| 5.4  | `enrichment.job-processor.spec.ts` + `enrichment-event-handler.spec.ts`                               | Unit             | Written | 7/7     | DLQ routing, finalAttempt flag, ai.enabled gate                                         |
| 5.5  | `semantic-model.builder.merge.spec.ts` + KG service specs + enum specs                                | Unit             | Written | 8/8+    | AI role override, lifecycle nodes/edges, dtoFields, project stamp                       |
| 5.6  | `ai.module.spec.ts` + `knowledge-graph.module.spec.ts` + e2e KG specs                                 | Unit/Integration | n/a     | updated | full override sets for forwardRef'd modules                                             |
| 5.7  | RFC-009 §14 amend (doc-only)                                                                          | Docs             | n/a     | n/a     | signatures-only override, XML isolation, deny-list                                      |
| 5.8  | `enrichment-pipeline.integration.spec.ts`                                                             | Integration      | Written | 4/4     | MockProvider fixtures keyed by real manifest sha256                                     |

## Test Summary

- `npx jest` (full backend): 92 suites, 721 tests, 0 failures (was 83/663 at PR 3 → +9 suites, +58 tests)
- `npx tsc --noEmit`: 0 errors
- `npx eslint` on changed src: 0 errors
- Layers: Unit (5.1-5.6) + Integration (5.8, full pipeline with MockProvider)

## Files Changed (PR 4)

| File                                                                                          | Action | Description                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/backend/src/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity.ts`  | Create | `IrEnrichmentEntity` — jsonb classes/failed_units, unique `analysis_id`, timestamptz `completed_at`                                                                                        |
| `src/backend/src/modules/ai/infrastructure/persistence/repositories/enrichment.repository.ts` | Create | `findByAnalysisId` (idempotency) + `save` (REQ-EP-006)                                                                                                                                     |
| `src/backend/src/modules/ai/application/three-gates-validator.service.ts`                     | Create | Schema (class-validator, whitelist+forbidNonWhitelisted) / referential (IR lookup, drop) / confidence (≥0.7) gates + `parseLifecycleEntry`                                                 |
| `src/backend/src/modules/ai/application/enrichment.service.ts`                                | Create | 7-stage orchestration (load → idempotency → assemble → prompt → provider → validate → persist), schema retry once w/ feedback, `detectFramework`, failed only on final attempt             |
| `src/backend/src/modules/ai/infrastructure/jobs/enrichment.job-processor.ts`                  | Create | `@Processor('ai-enrichment')` — 3 attempts, exponential backoff, DLQ routing, finalAttempt flag                                                                                            |
| `src/backend/src/modules/ai/infrastructure/events/enrichment-event-handler.ts`                | Create | `analysis.completed` → enqueue; `ai.enabled=false` short-circuits (REQ-EP-001)                                                                                                             |
| `src/backend/src/modules/ai/domain/ai-enrichment.entity.ts`                                   | Modify | Add `FailedUnit` interface, `failedUnits` on aggregate, per-class `status: 'accepted' \| 'low-confidence'`                                                                                 |
| `src/backend/src/modules/analysis/application/file-manifest.service.ts`                       | Modify | Add `computeManifestSha256` — deterministic composite hash (sorted entries) as the enrichment cache key                                                                                    |
| `src/backend/src/modules/knowledge-graph/domain/node-type.enum.ts`                            | Modify | Add GUARD, PIPE, INTERCEPTOR, MIDDLEWARE                                                                                                                                                   |
| `src/backend/src/modules/knowledge-graph/domain/edge-type.enum.ts`                            | Modify | Add PROTECTS, TRANSFORMS                                                                                                                                                                   |
| `src/backend/src/modules/knowledge-graph/application/semantic-model.builder.ts`               | Modify | `build(ir, enrichment?)` — AI role overrides resolveClassType; lifecycle nodes + PROTECTS/TRANSFORMS edges; dtoFields metadata; project framework/architecture                             |
| `src/backend/src/modules/knowledge-graph/application/knowledge-graph.service.ts`              | Modify | Inject EnrichmentRepository, load enrichment before buildGraph, pass to builder                                                                                                            |
| `src/backend/src/modules/ai/ai.module.ts`                                                     | Modify | Register ContextAssembler/ThreeGatesValidator/EnrichmentService/Repository/JobProcessor/EventHandler; import AnalysisModule + forwardRef(KnowledgeGraphModule); onModuleInit wires handler |
| `src/backend/src/modules/knowledge-graph/knowledge-graph.module.ts`                           | Modify | import forwardRef(AiModule) for EnrichmentRepository                                                                                                                                       |
| `src/backend/src/app.module.ts`                                                               | Modify | Import AiModule                                                                                                                                                                            |
| `docs/architecture/RFC-009-AI-Orchestration.md`                                               | Modify | §14 amend: signatures-only override, XML isolation, deny-list, no-secrets                                                                                                                  |
| 15 test files (new + updated)                                                                 | Modify | RED→GREEN specs per task + integration spec                                                                                                                                                |

## Deviations / Decisions

- **Circular module deps via forwardRef**: AiModule needs GraphQueryService (KG module) for ContextAssembler while KnowledgeGraphService needs EnrichmentRepository (AI module) for the merge — both modules import each other with `forwardRef`. Module/e2e specs compile the full graph with the standard override set (DataSource, repo tokens, queues).
- **manifestSha256 composite**: spec says "obtained from FileManifestService" but only per-file hashes were stored; added `FileManifestService.computeManifestSha256` — sha256 over sorted `path\u0000hash` entries, so any file add/modify/delete changes the key. MockProvider fixtures in integration tests are keyed by this real digest.
- **Schema retry once with feedback**: Gate 1 failure appends `"Your previous response failed validation: <errors>. Respond again with a corrected JSON object."` and re-calls the provider; a second failure aborts the pipeline (deterministic fallback).
- **`enrichment.failed` only on final attempt**: `EnrichmentJobProcessor` computes `finalAttempt` from `job.attemptsMade` and forwards it to the service — matches REQ-EP-002 "failed emitted only after the final retry".
- **Per-unit fallback granularity**: MVP sends one prompt for all sketches (design open question §OQ2 resolved: single-call MVP); per-unit fallback is realized inside the gates — referential drops and low-confidence downgrades land in `failedUnits` while remaining units persist (REQ-EP-003 partial success).
- **`enrichment.skipped` reason `no_source_units`**: when context assembly yields zero sketches (all files filtered), the job skips instead of failing — deterministic path is authoritative; nothing to enrich.
- **RFC-009 §14 override**: the "no raw source code" rule is explicitly amended (14.1) for signature-level sketches built from the IR — no bodies, XML-isolated as untrusted `<code>`, `.env*` + ignored-dir deny-list, no secrets. Design.md flagged this override at the top; tasks 5.7 codified it.
- **Lifecycle FQNs**: `parseLifecycleEntry('guard:JwtGuard')` → `{kind:'guard', name:'JwtGuard'}`; node FQN `${classFqn}~guard:JwtGuard` (unique per class); `handler` entries are the class itself → no node. PROTECTS for guard, TRANSFORMS for pipe/interceptor/middleware, edge lifecycle-node → class-node (RFV direction Guard→Endpoint).
- **`detectFramework(ir)` heuristic**: decorators/imports scan for nestjs/express markers, `'unknown'` falls back to the generic framework config — the LLM's returned framework (validated) is what persists on the artifact.
- **ACCEPTS/RETURNS edges deferred**: REQ-EP-007 spec table mentions them for dtoFields, but the task scope (5.5) lists only PROTECTS/TRANSFORMS; dtoFields metadata lands on DTO node properties, ACCEPTS/RETURNS coordination left to the RFV change.

## Completion

All 8 tasks of Phase 5 complete → ai-enrichment change fully implemented (PRs 1-4). Final full-suite state: 92 suites / 721 tests green, tsc + eslint clean. The tracker `feat/ai-enrichment` is ready for the final merge to main.
