# Design: AI Lifecycle Analysis (classify-lifecycle)

## Technical Approach

Reuse the shipped 7-stage pipeline (`ai-enrichment` + `epic-008`): `analysis.completed` → `ai-enrichment` queue → `EnrichmentService.run()` → sketches → prompt → provider → 3 gates → `IrEnrichment` persist → KG merge (`semantic-model.builder.build(ir, enrichment)`). This change is additive: (1) register `classify-lifecycle` in `CapabilityRegistry`; (2) add v1 `examples.json`; (3) replace decorator/import-only `detectFramework()` with manifest-candidate detection confirmed by the LLM; (4) golden + injection-tripwire eval on the Mock provider (CI never hits live APIs). Deterministic classification becomes per-unit fallback (RFC-001, RFC-007 honesty). Scope (locked): TypeScript manifests (`package.json`) only; knowledge-graph merge is out of scope (already shipped by `ai-enrichment`).

## Architecture Decisions

| #     | Decision                                                                                                          | Options / tradeoff                                                                            | Rationale                                                                                                                                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-1 | Capture manifest candidates at **analysis** time, persist on `Analysis`                                           | vs. parse in `EnrichmentService` (re-adds filesystem I/O, breaks "IR+KG only" invariant)      | Enrichment never reads the filesystem; §14.1 scopes provider data to sketches — manifests are metadata parsed where `repoPath` is on disk                                                                                                                                           |
| ADR-2 | Marker map as a deterministic constant in the analysis module (**`package.json` only**); LLM output authoritative | vs. config-driven markers in `ai.frameworks/*.json` (analysis→AI dependency, wrong direction) | RFC-001 deterministic-first; detection emits `{ candidates, primary }` with no deterministic confidence; LLM confirms `{framework, architecture, confidence}` (REQ-EP-004); no manifest → `primary: 'unknown'`/`[]`, never guessed. Non-TS markers deferred to `parser-abstraction` |
| ADR-3 | Load `ai.frameworks/{top-candidate}.json`, generic on ambiguity                                                   | vs. per-candidate merge (complexity, no v1 benefit)                                           | RFC-010 config-driven; "add framework = config + golden tests"; decorator/import scan stays fallback                                                                                                                                                                                |
| ADR-4 | Eval keyed by `manifestSha256` fixture + Mock provider                                                            | vs. live provider in CI (non-deterministic, secrets)                                          | Mock already loads `{capability}/{sha}.response.json`; RFC-010 §11.3                                                                                                                                                                                                                |

## Module Layout (DDD bounded contexts)

```
src/backend/src/modules/
├── analysis/                          # capture manifest candidates
│   ├── application/manifest-framework-detector.ts   (new)
│   ├── application/static-analysis.service.ts       (invoke + persist)
│   ├── domain/framework-candidate.vo.ts             (new)
│   ├── domain/analysis.entity.ts                    (+frameworkCandidates)
│   └── infrastructure/persistence/…/analysis.typeorm-entity.ts (+repository)
└── ai/                                # capability + confirm
    ├── ai.capabilities/classify-lifecycle/v1/examples.json   (new)
    ├── ai.module.ts                                       (register capability)
    ├── application/enrichment.service.ts                  (candidates → confirm)
    └── application/prompt-builder.service.ts              (inject candidates)
```

## Data Flow

### classify-lifecycle (happy path)

```
analysis: computeManifest + buildIr + ManifestFrameworkDetector → candidates
   └─ persist frameworkCandidates → analysis.completed
ai-enrichment worker → EnrichmentService.run()
   ├─ detectFrameworkCandidates(analysis) → [nestjs] + primary config
   ├─ PromptBuilder({capability, frameworkCandidates, sketches, kgContext})
   ├─ provider.enrich()   (Mock in CI)
   ├─ ThreeGatesValidator (schema→referential→confidence)
   └─ IrEnrichment persist → enrichment.completed
KG: semantic-model.builder.build(ir, enrichment)
   ├─ framework/architecture → Project node props
   ├─ AI role overrides resolveClassType()
   └─ lifecycle nodes/edges (PROTECTS/TRANSFORMS/INVOKES/INJECTS)
```

### Fallback path (per-unit)

```
LLM schema fail ×2 | provider outage | ai.enabled=false
   → no IrEnrichment (or failedUnits persisted)
   → semantic-model.builder.build(ir)  [no enrichment]
   → deterministic resolveClassType + UNKNOWN (unchanged)
```

## File Changes

| File                                                     | Action | Description                                                                     |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `analysis/application/manifest-framework-detector.ts`    | Create | Parse `package.json` only → candidates (TS manifests; non-TS deferred)          |
| `analysis/domain/framework-candidate.vo.ts`              | Create | `FrameworkCandidate {framework, file, markers}`                                 |
| `analysis/domain/analysis.entity.ts`                     | Modify | Add `frameworkCandidates` (additive)                                            |
| `analysis/application/static-analysis.service.ts`        | Modify | Run detector; persist candidates                                                |
| `analysis/infrastructure/persistence/…`                  | Modify | jsonb column + repo mapping                                                     |
| `ai/ai.capabilities/classify-lifecycle/v1/examples.json` | Create | Few-shot: nestjs/express/unknown                                                |
| `ai/ai.module.ts`                                        | Modify | Register `classify-lifecycle` with `LifecycleEnrichmentDto` outputFormat        |
| `ai/application/enrichment.service.ts`                   | Modify | `detectFramework` → `detectFrameworkCandidates` (manifest + decorator fallback) |
| `ai/application/prompt-builder.service.ts`               | Modify | Inject `{{framework_candidates}}`                                               |
| `test/fixtures/mini-express/**`                          | Create | Express golden source fixture                                                   |
| `ai/ai.fixtures/classify-lifecycle/{sha}.response.json`  | Create | Golden expected outputs                                                         |
| `test/ai-lifecycle.e2e-spec.ts`                          | Create | Eval harness: golden + tripwire + determinism                                   |

## Interfaces / Contracts

```typescript
interface FrameworkCandidate { framework: string; file: string; markers: string[] }
detectFrameworkCandidates(analysis): { candidates: FrameworkCandidate[]; primary: string }
PromptBuilder.build({ capabilityId, framework, frameworkCandidates, kgContext, sketches })
```

Output schema unchanged: `LifecycleEnrichmentDto` (`framework`, `architecture`, `confidence`, `classes[]`), consumed by `ThreeGatesValidator`.

**Confidence gate (pinned)**: `CONFIDENCE_THRESHOLD = 0.7`. Items below `0.7` classify as `Unknown` and trigger the deterministic fallback. This MUST be a named constant (already `CONFIDENCE_THRESHOLD` in `three-gates-validator.service.ts`) — never a magic number at apply time.

## Testing Strategy

| Layer       | What                                                                | Approach                                                            |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Unit        | Manifest detector (each type), `detectFrameworkCandidates` fallback | Jest, pure functions, fixture manifests                             |
| Integration | `EnrichmentService.run()` on Mock → 3 gates → persist               | jest-e2e, `ai.enabled` + mock provider                              |
| Eval        | Golden nestjs/express classifications; tripwires; determinism       | `test/ai-lifecycle.e2e-spec.ts`, golden JSON equality, 0 live calls |

## Migration / Rollout

No DB migration — `frameworkCandidates` is additive nullable jsonb. Rollback = drop `classify-lifecycle` files + registration + revert spec deltas; `ai.enabled=false` already disables enrichment.

## Resolved Decisions (locked)

- **Non-TS manifest markers**: DEFERRED until `parser-abstraction` lands. This change ships TypeScript manifests (`package.json`) only.
- **Eval harness location**: `test/ai-lifecycle.e2e-spec.ts` under the existing jest-e2e config (`test/jest-e2e.json`). No new `ai` unit-spec tree.
- **Confidence threshold**: pinned at `0.7` (`CONFIDENCE_THRESHOLD` named constant); below → `Unknown` + deterministic fallback.
- **knowledge-graph-model**: OUT OF SCOPE — merge already shipped by `ai-enrichment`; no graph-merge work in sdd-tasks.
