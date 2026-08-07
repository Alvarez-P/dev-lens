# ai-enrichment-pipeline Specification

> **Archived from**: `ai-enrichment` (2026-08-07)

## Purpose

Define the event-driven AI enrichment pipeline: a BullMQ worker triggered by `analysis.completed` that assembles context, calls the LLM, validates output through a three-gate pipeline, and produces `IrEnrichment` artifacts merged into the Knowledge Graph. Per the exploration §2.4, this follows **Option B + C**: a separate additive enrichment stage with per-unit deterministic fallback.

## Requirements

### Requirement: Event-Driven Trigger

The system SHALL register an `EnrichmentEventHandler` for `analysis.completed` events, following the identical pattern as `KnowledgeGraphEventHandler`. The handler SHALL extract `analysisId`, `repositoryId`, and `snapshotId` from the event and enqueue a BullMQ job on the `ai-enrichment` queue. If `ai.enabled = false`, the handler SHALL return immediately without enqueuing any job.

#### Scenario: analysis.completed triggers enrichment job

- GIVEN `ai.enabled = true` and a registered handler
- WHEN an `AnalysisCompletedEvent` is dispatched with `analysisId = 'X'`
- THEN a BullMQ job is enqueued on `ai-enrichment` containing `{ analysisId: 'X', repositoryId, snapshotId }`
- AND `enrichment.started` is emitted when the job begins

#### Scenario: AI disabled, no job enqueued

- GIVEN `ai.enabled = false`
- WHEN `analysis.completed` is dispatched
- THEN the handler returns immediately
- AND no job appears in the `ai-enrichment` queue
- AND the existing deterministic pipeline continues unchanged

### Requirement: BullMQ Queue and Dead Letter Queue

The system SHALL create two BullMQ queues: `ai-enrichment` and `ai-enrichment-dlq` (Dead Letter Queue). Queue configuration SHALL mirror the existing `analysis` and `knowledge-graph` queues: 3 attempts with exponential backoff, max 60000ms timeout per job, failed jobs routed to DLQ after exhausting retries. Queue registration SHALL occur in `AiModule.onModuleInit()` or via `BullModule.registerQueue()`.

#### Scenario: Job retries on transient failure

- GIVEN an enrichment job that fails due to a provider timeout
- WHEN the processor throws a retriable `ProviderUnavailableError`
- THEN BullMQ retries up to 2 more times with exponential backoff
- AND `enrichment.failed` is emitted only after the final retry

#### Scenario: All retries exhausted routes to DLQ

- GIVEN all 3 attempts fail with `ContextBudgetExceededError` (non-retriable after first attempt)
- WHEN the retry limit is reached
- THEN the job is moved to `ai-enrichment-dlq`
- AND the snapshot enrichment status is marked `failed`

### Requirement: Enrichment Pipeline Stages

`EnrichmentWorker` SHALL execute the following stages in strict sequence:

| Stage                | Component                                        | Input                                   | Output                          |
| -------------------- | ------------------------------------------------ | --------------------------------------- | ------------------------------- |
| 1. Load Analysis     | `AnalysisRepository`                             | `analysisId`                            | IR + manifest sha256 map        |
| 2. Idempotency Check | `EnrichmentRepository`                           | `analysisId`                            | Skip if `IrEnrichment` exists   |
| 3. Assemble Context  | `ContextAssembler`                               | IR + KG                                 | `CodeSketch[]` (cached)         |
| 4. Build Prompt      | `PromptBuilder`                                  | Sketches + templates + framework config | Full prompt (≤6000 tokens)      |
| 5. Call Provider     | `AIProvider.enrich()`                            | Prompt                                  | Raw JSON response               |
| 6. Validate Output   | 3-gate validator                                 | Raw response + IR                       | Validated `IrEnrichment`        |
| 7. Persist & Merge   | `EnrichmentRepository` + `KnowledgeGraphService` | `IrEnrichment`                          | Persisted enrichment + KG merge |

If any stage fails for a specific analysis unit (file), that unit SHALL fall back to deterministic classification independently — other units continue unaffected.

#### Scenario: Full pipeline produces IrEnrichment

- GIVEN a valid `analysis.completed` event for a NestJS repository
- WHEN the pipeline executes all 7 stages
- THEN `IrEnrichment` is persisted with framework, architecture, and per-class classifications
- AND `enrichment.completed` is emitted
- AND `KnowledgeGraphService` merges enrichment into the semantic model

#### Scenario: Per-unit fallback on LLM failure

- GIVEN the LLM call succeeds for `users.controller.ts` but fails validation for `auth.controller.ts`
- WHEN the per-unit retry also fails
- THEN `users.controller.ts` receives AI-classified roles
- AND `auth.controller.ts` falls back to deterministic classification (`UNKNOWN`)
- AND the pipeline reports partial success with `failedUnits: [{ fqn: '...', reason: '...' }]`

### Requirement: Three-Gate Output Validation

LLM output SHALL pass through three validation gates before persistence:

| Gate                     | Validator                   | Checks                                                                                  | Action on Failure                       |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| 1. Schema                | `class-validator` DTO       | Type correctness, required fields, enum values, `whitelist` + `forbidNonWhitelisted`    | Retry once with error feedback          |
| 2. Referential Integrity | `IrValidator` pattern       | All FQNs, class names, DTO names must resolve against IR                                | Drop unresolvable entries; log warning  |
| 3. Confidence Threshold  | `confidence` field per item | `confidence >= 0.7` → accept; `< 0.7` → flag as `needsReview` or downgrade to `UNKNOWN` | Emit `UNKNOWN` for low-confidence items |

Gate 1 failure retries ONCE with the validation errors appended to the prompt. Gate 2 drops individual entries — it does not fail the whole output. Gate 3 downgrades per-item. All three gates MUST pass before any enrichment data is persisted.

#### Scenario: Schema validation fails, retries with feedback

- GIVEN LLM output missing the required `framework` field
- WHEN Gate 1 (`class-validator`) rejects it with `"framework must be a string"`
- THEN the enrichment worker retries the LLM call once, appending: `"Your previous response failed validation: framework must be a string. Respond again with a corrected JSON object."`
- AND the retried output passes schema validation

#### Scenario: Referential integrity drops hallucinated class

- GIVEN LLM output references `FakeService` which does not exist in the IR
- WHEN Gate 2 (referential integrity) checks it
- THEN `FakeService` is dropped from the output with a warning: `"Referential check: FQN 'FakeService' not found in IR — dropped"`
- AND remaining valid entries are preserved

#### Scenario: Low-confidence items downgraded

- GIVEN an LLM classification with `confidence: 0.35` for a class role
- WHEN Gate 3 (confidence threshold) checks it
- THEN the role is downgraded to `UNKNOWN`
- AND the enrichment reports it as `status: 'low-confidence'`

### Requirement: IrEnrichment Artifact

The system SHALL define `IrEnrichment` as:

```typescript
interface IrEnrichment {
  analysisId: string;
  repositoryId: string;
  manifestSha256: string; // cache key — matches analysis manifest
  framework: string; // e.g., 'nestjs', 'express'
  architecture: string; // e.g., 'mvc', 'ddd', 'hexagonal'
  confidence: number; // 0–1, overall framework/architecture confidence
  classes: AIClassifiedRole[]; // per-class classifications
  completedAt: Date;
}

interface AIClassifiedRole {
  fqn: string; // matches IrNode.fqn
  role: string; // e.g., 'controller', 'service', 'repository', 'guard', 'pipe', 'interceptor'
  lifecycle: string[]; // e.g., ['guard:JwtGuard', 'pipe:ValidationPipe', 'handler']
  dtoFields: AIDtoField[]; // empty if not a DTO class
  confidence: number; // 0–1
  sourceFile: string; // from IrNode.filePath
}

interface AIDtoField {
  name: string;
  type: string;
  optional: boolean;
}
```

`IrEnrichment` SHALL be persisted as a TypeORM entity with `jsonb` properties. It MUST be immutable after creation — no partial updates.

#### Scenario: Full IrEnrichment for NestJS controller

- GIVEN enrichment pipeline processes a NestJS project
- WHEN output is validated and persisted
- THEN `framework` is `nestjs`, `architecture` is `mvc` or `ddd`
- AND `classes` includes the controller FQN with `role: 'controller'`, lifecycle steps, and `sourceFile`
- AND `completedAt` is set to the current timestamp

### Requirement: Idempotency via Manifest sha256

The pipeline SHALL skip enrichment if an `IrEnrichment` already exists for `analysisId` AND its `manifestSha256` matches the current analysis manifest — meaning no source files have changed. This check occurs at stage 2 (idempotency check) before any expensive context assembly or LLM calls. The manifest sha256 SHALL be obtained from `FileManifestService` (already computed during analysis).

#### Scenario: Unchanged files skip enrichment

- GIVEN `IrEnrichment` exists for `analysisId = 'X'` with `manifestSha256` matching analysis
- WHEN the enrichment worker processes the job
- THEN stages 3–7 are skipped entirely
- AND `enrichment.skipped` is emitted with reason `'manifest_unchanged'`

#### Scenario: Changed files trigger re-enrichment

- GIVEN `IrEnrichment` exists for `analysisId = 'X'` but `manifestSha256` differs
- WHEN the enrichment worker processes the job
- THEN the full pipeline runs from stage 3
- AND a new `IrEnrichment` replaces the previous one

### Requirement: Knowledge Graph Merge

`KnowledgeGraphService` SHALL consume `IrEnrichment` during `buildGraph()`:

| Enrichment Field             | KG Merge Target                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `framework`, `architecture`  | Project node `properties`                                                                          |
| `AIClassifiedRole.role`      | Feed `SemanticModelBuilder.resolveClassType()` — AI role overrides heuristic                       |
| `AIClassifiedRole.lifecycle` | Create lifecycle nodes/edges: GUARD, PIPE, INTERCEPTOR, MIDDLEWARE with PROTECTS, TRANSFORMS edges |
| `AIClassifiedRole.dtoFields` | Create/update DTO nodes with field metadata, ACCEPTS/RETURNS edges                                 |

If AI enrichment is absent (disabled, failed, or not yet run for this analysis), `KnowledgeGraphService` SHALL use the existing deterministic `resolveClassType()` behavior — zero behavior change to the non-AI path.

#### Scenario: AI role overrides heuristic in resolveClassType

- GIVEN `AIClassifiedRole` classifies `UsersService` as `role: 'service'` with `confidence: 0.92`
- WHEN `SemanticModelBuilder.resolveClassType()` processes it
- THEN the AI role is used (not the name-based heuristic)
- AND the node type is `Service`

#### Scenario: No enrichment, deterministic path unchanged

- GIVEN no `IrEnrichment` exists for the current analysis
- WHEN `KnowledgeGraphService.buildGraph()` executes
- THEN `resolveClassType()` uses the existing heuristic (decorator registry + name patterns)
- AND `UNKNOWN` is emitted for unrecognized classes

### Requirement: Graceful Degradation

The enrichment pipeline SHALL degrade gracefully at every failure point:

| Failure                              | Behavior                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `ai.enabled = false`                 | Pipeline skipped entirely — queue handler does nothing                              |
| Provider unavailable                 | All units get deterministic classification; `enrichment.failed` emitted with reason |
| LLM call fails per-unit              | That unit gets deterministic classification; other units processed normally         |
| Validation failure (retry exhausted) | That unit gets deterministic classification; `failedUnits[]` in enrichment artifact |
| `ContextBudgetExceededError`         | Pipeline aborts; all units get deterministic classification                         |

Under NO circumstance SHALL an AI pipeline failure prevent the deterministic analysis pipeline from completing successfully. The AI stage is strictly additive.

#### Scenario: AI disabled, deterministic pipeline unchanged

- GIVEN `ai.enabled = false`
- WHEN a `repository.synchronized` event triggers the full pipeline
- THEN analysis completes, IR is built, knowledge graph is built using deterministic classification
- AND no AI stage runs
- AND zero AI-related errors or warnings appear

#### Scenario: Provider down, full deterministic fallback

- GIVEN the Ollama provider is unreachable
- WHEN the enrichment worker calls `provider.enrich()`
- THEN `ProviderUnavailableError` is thrown
- AND all analysis units fall back to deterministic classification
- AND `enrichment.failed` is emitted with reason `'provider_unavailable'`
- AND the knowledge graph is built with deterministic roles and `UNKNOWN`

### Requirement: Enrichment Domain Events

The pipeline SHALL emit three event types:

| Event                  | Emitted When                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `enrichment.started`   | Job begins processing                                           |
| `enrichment.completed` | `IrEnrichment` persisted successfully (full or partial)         |
| `enrichment.failed`    | Pipeline cannot complete (provider down, budget exceeded, etc.) |
| `enrichment.skipped`   | Idempotency check passes (manifest unchanged)                   |

Each event SHALL include: `analysisId`, `repositoryId`, `snapshotId`, `correlationId`, `timestamp`, and for `completed`/`failed`: `unitCount` and `failedUnitCount`.

#### Scenario: Partial success emits completed with failed count

- GIVEN 10 units processed, 8 succeeded, 2 fell back
- WHEN the pipeline completes
- THEN `enrichment.completed` is emitted with `unitCount: 10` and `failedUnitCount: 2`
- AND `failedUnits` details are persisted in the `IrEnrichment` artifact
