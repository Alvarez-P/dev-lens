# Design: AI Enrichment Pipeline (MVP)

## Technical Approach

Add a separate `ai` bounded context that runs as a BullMQ stage after deterministic analysis, enriching the Knowledge Graph with LLM-classified roles, lifecycles, DTO types, and framework detection. Follows the `analysis.completed` → queue → worker → persist pattern already used by `KnowledgeGraphModule`. Context is assembled exclusively from the Graph Query Service and IR — never raw filesystem reads. AI is strictly additive: `ai.enabled=false` or provider failure leaves the deterministic pipeline untouched. RFC-009 §14 is intentionally overridden to allow signature-level code sketches (no bodies, XML-isolated, `.env*` deny-listed).

## Architecture Decisions

| Decision               | Options                                                    | Chosen                                            | Rationale                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Insertion point**    | (A) Replace classification inside IR build                 | **B: separate enrichment stage**                  | Zero regression risk; re-runnable without re-parsing; matches `KnowledgeGraphModule` pattern; RFC-001 "Deterministic Before Intelligent"                                                        |
| **Validator library**  | class-validator (in-tree) vs zod vs ajv                    | **class-validator**                               | Zero new deps per RFC-001 minimal-deps principle; codebase already uses `class-validator` for DTOs with `whitelist`/`forbidNonWhitelisted`; migrate to ajv only if schema complexity demands it |
| **LLM SDK**            | openai + custom Ollama fetch vs LangChain vs Vercel AI SDK | **openai only**                                   | Single new dep; Ollama via fetch (zero-deps); Mock zero-deps; avoids LangChain abstraction overhead for MVP batch pipeline                                                                      |
| **Cache backend**      | Redis vs in-memory Map                                     | **Redis-deferred: in-memory Map for sketches**    | Redis is the design target per RFC-009 but `ioredis` already available; `FileManifestService` sha256 gives cache key; response cache uses same key scheme; no new infra                         |
| **sourceFile storage** | jsonb properties vs dedicated column                       | **dedicated TEXT NULL column**                    | Exists in `SemanticNode` already; KG spec Gap G1; nullable column is additive and queryable directly — `SELECT WHERE source_file = X` without jsonb extraction                                  |
| **Provider selection** | manual `if/else` vs factory registry                       | **token-based registry (`AI_PROVIDER_REGISTRY`)** | Mirrors `PARSER_REGISTRY` pattern from `AnalysisModule`; new providers are added by registering another `@Injectable()` adapter                                                                 |

## Data Flow

```
analysis.completed (DomainEvent)
  → EnrichmentEventHandler (AiModule.onModuleInit)
    → BullMQ "ai-enrichment" queue
      → EnrichmentWorker.process()
        1. AnalysisRepository.findById(analysisId) → IR + manifest
        2. EnrichmentRepository.findByAnalysisId() → skip if cached & sha256 match
        3. ContextAssembler.assemble(repoId, ir)
           ├─ GraphQueryService.getNodes() → KG context (project, modules)
           └─ CodeSketchBuilder.build(ir) → CodeSketch[] (signatures only, ≤4000 tokens/sketch)
        4. PromptBuilder.build(sketches, framework) → prompt (≤6000 tokens)
           ├─ system.md + instructions.md (versioned templates)
           ├─ <code> XML-delimited sketches (untrusted data)
           └─ framework config injection
        5. AIProvider.enrich(request) → raw JSON
        6. ThreeGatesValidator.validate(json, ir)
           ├─ Gate 1: class-validator schema → retry once on fail
           ├─ Gate 2: referential integrity vs IR → drop unresolvable
           └─ Gate 3: confidence ≥ 0.7 → accept, else UNKNOWN
        7. EnrichmentRepository.save(enrichment) + emit enrichment.completed
  → KnowledgeGraphService.buildGraph()
    ├─ SemanticModelBuilder.build() reads IrEnrichment
    ├─ AI role overrides resolveClassType() heuristic
    └─ GraphBuilder persists with lifecycle/architecture on Project node
ai.enabled=false → handler returns immediately, step 0 skipped
```

## File Changes

| File                                                                                                      | Action | Description                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `src/backend/src/modules/ai/domain/ai-provider.interface.ts`                                              | Create | `AIProvider` interface (complete, streamComplete, healthCheck, estimateCost, enrich)              |
| `src/backend/src/modules/ai/domain/ai-request.vo.ts`                                                      | Create | `AIRequest`, `AIResponse`, `AIEnrichmentRequest`, `AIEnrichmentResponse`, `AIChunk` value objects |
| `src/backend/src/modules/ai/domain/ai-errors.ts`                                                          | Create | `BaseAIError` + 6 typed subclasses (ProviderUnavailable, ContextBudgetExceeded, etc.)             |
| `src/backend/src/modules/ai/domain/ai-enrichment.entity.ts`                                               | Create | `IrEnrichment` aggregate root with `AIClassifiedRole[]`                                           |
| `src/backend/src/modules/ai/domain/ai-events.ts`                                                          | Create | `EnrichmentStarted/Completed/Failed/Skipped` events (mirrors `GraphBuiltEvent`)                   |
| `src/backend/src/modules/ai/domain/code-sketch.vo.ts`                                                     | Create | `CodeSketch` value object (sourceFile, className, decorators, methods, truncated)                 |
| `src/backend/src/modules/ai/application/context-assembler.service.ts`                                     | Create | Reads KG + IR, produces `CodeSketch[]`, enforces allow/deny-list                                  |
| `src/backend/src/modules/ai/application/prompt-builder.service.ts`                                        | Create | Loads versioned templates, injects XML-delimited sketches, enforces 6000 token budget             |
| `src/backend/src/modules/ai/application/enrichment.service.ts`                                            | Create | Orchestrates 7-stage pipeline (load → assemble → prompt → call → validate → persist)              |
| `src/backend/src/modules/ai/application/three-gates-validator.service.ts`                                 | Create | Schema (class-validator), referential (IR lookup), confidence (≥0.7) gates                        |
| `src/backend/src/modules/ai/application/provider-selector.service.ts`                                     | Create | Resolves `ai.default_model` to provider, falls back to first healthy                              |
| `src/backend/src/modules/ai/infrastructure/openai.provider.ts`                                            | Create | `OpenAIProvider` using `openai` SDK, adapts `AIRequest` to OpenAI format                          |
| `src/backend/src/modules/ai/infrastructure/ollama.provider.ts`                                            | Create | `OllamaProvider` using `fetch`, adapts to `/api/generate`                                         |
| `src/backend/src/modules/ai/infrastructure/mock.provider.ts`                                              | Create | `MockProvider` returning fixtures from `ai/fixtures/`, keyed by sha256                            |
| `src/backend/src/modules/ai/infrastructure/jobs/enrichment.job-processor.ts`                              | Create | `@Processor('ai-enrichment')` — mirrors `KnowledgeGraphJobProcessor`                              |
| `src/backend/src/modules/ai/infrastructure/events/enrichment-event-handler.ts`                            | Create | Listens for `analysis.completed`, enqueues job if `ai.enabled`                                    |
| `src/backend/src/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity.ts`              | Create | `IrEnrichment` entity with `jsonb` properties, unique on `analysisId`                             |
| `src/backend/src/modules/ai/infrastructure/persistence/repositories/enrichment.repository.ts`             | Create | CRUD for `IrEnrichment`, `findByAnalysisId` for idempotency check                                 |
| `src/backend/src/modules/ai/ai.module.ts`                                                                 | Create | Registers queue, entities, providers; `onModuleInit` wires event handler                          |
| `src/backend/src/modules/ai/ai.tokens.ts`                                                                 | Create | `AI_ENRICHMENT_QUEUE`, `AI_ENRICHMENT_DLQ`, `AI_PROVIDER_REGISTRY` tokens                         |
| `src/backend/src/modules/ai/ai.frameworks/nestjs.json`                                                    | Create | Framework format config: decorator semantics, lifecycle order                                     |
| `src/backend/src/modules/ai/ai.frameworks/express.json`                                                   | Create | Framework format config for Express middleware chain                                              |
| `src/backend/src/modules/ai/ai.capabilities/classify-lifecycle/v1/system.md`                              | Create | System prompt: role, constraints, JSON output format                                              |
| `src/backend/src/modules/ai/ai.capabilities/classify-lifecycle/v1/instructions.md`                        | Create | Task instructions: classification, lifecycle, DTO extraction                                      |
| `src/backend/src/config/configuration.ts`                                                                 | Modify | Add `AiConfig` interface + `ai:` section to `AppConfiguration`                                    |
| `src/backend/.env.example`                                                                                | Modify | Add `OPENAI_API_KEY`, `OPENAI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `AI_ENABLED`             |
| `src/backend/src/app.module.ts`                                                                           | Modify | Import `AiModule`                                                                                 |
| `src/backend/src/modules/knowledge-graph/domain/graph-node.vo.ts`                                         | Modify | Add `sourceFile: string                                                                           | null`parameter to`GraphNode.create/reconstitute` |
| `src/backend/src/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity.ts` | Modify | Add `@Column({ name: 'source_file', type: 'text', nullable: true }) sourceFile`                   |
| `src/backend/src/modules/knowledge-graph/application/semantic-model.builder.ts`                           | Modify | Consume `IrEnrichment` in `resolveClassType()` — AI role overrides heuristic                      |
| `src/backend/src/modules/knowledge-graph/application/knowledge-graph.service.ts`                          | Modify | Load `IrEnrichment` via `EnrichmentRepository` before `buildGraph()`, pass to builder             |
| `src/backend/package.json`                                                                                | Modify | Add `openai` dependency                                                                           |
| `docs/architecture/RFC-009-AI-Orchestration.md`                                                           | Modify | Amend §14: explicit override for signature-level sketches with isolation and deny-list            |

## Interfaces / Contracts

```typescript
// AIProvider — single contract all adapters implement
interface AIProvider {
  complete(req: AIRequest): Promise<AIResponse>;
  streamComplete(req: AIRequest): Observable<AIChunk>; // MVP stub
  healthCheck(): Promise<boolean>;
  estimateCost(req: AIRequest): number;
  enrich(req: AIEnrichmentRequest): Promise<AIEnrichmentResponse>;
}

// CodeSketch — what the LLM sees per source file
interface CodeSketch {
  sourceFile: string;
  className: string;
  decorators: string[]; // with arguments (e.g., '@Controller("users")')
  extends?: string;
  implements: string[];
  constructorParams: { name: string; type: string; decorators: string[] }[];
  methods: { name: string; decorators: string[]; params: ParamSketch[]; returnType: string }[];
  imports: string[]; // resolved FQNs
  truncated: boolean;
}
```

## Testing Strategy

| Layer       | What to Test                                                                          | Approach                                                             |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Unit        | `CodeSketch` builder strips comments/strings/bodies                                   | Jest, input fixture → assert serialized output                       |
| Unit        | `PromptBuilder` enforces token budget, variable substitution                          | Jest, mock template loader, assert budget guard throws               |
| Unit        | `ThreeGatesValidator` schema, referential, confidence gates                           | Jest, class-validator DTO fixtures + mock IR                         |
| Unit        | `AIProvider` adapters: `MockProvider` returns fixtures, `OllamaProvider` shapes fetch | Jest, `MockProvider` with golden files                               |
| Integration | `EnrichmentWorker` 7-stage pipeline with mock provider                                | Jest + BullMQ test helpers, `MockProvider` returns known JSON        |
| Integration | Event handler wires `analysis.completed` → job enqueued                               | Jest, spy on `Queue.add()`, assert `ai.enabled=false` short-circuits |
| Integration | `sourceFile` propagated through graph node persistence                                | Jest, TypeORM test entity, assert column populated                   |
| E2E         | N/A (MVP backend-only change, no frontend surface)                                    | —                                                                    |

## Migration / Rollout

- **Migration**: `ALTER TABLE graph_nodes ADD COLUMN source_file TEXT NULL` — additive, nullable, no data migration needed
- **Rollback**: Set `ai.enabled=false` → stage skipped entirely. Remove `AiModule` import from `app.module.ts`. Drop `source_file` column. No destructive changes
- **CI safety**: `MockProvider` in test env, zero live API calls; `AI_ENABLED=false` in CI builds by default

## Open Questions

- [ ] **Provider for Anthropic deferred**: Proposal scopes MVP to OpenAI + Ollama + Mock. Anthropic adapter is out-of-scope — skip or add placeholder? (Spec lists OpenAI + Ollama + Mock only)
- [ ] **`IrEnrichment.classes` vs per-module enrichment granularity**: Pipeline sends one module per LLM call. Should one `IrEnrichment` span many classes across multiple calls, or one per module?
- [ ] **Redis cache availability**: Design targets Redis for response cache but proposal states "Redis context cache (in-memory... for MVP)." Confirm: is in-memory Map acceptable for both sketch and response caches in MVP, or should we use Redis now?
