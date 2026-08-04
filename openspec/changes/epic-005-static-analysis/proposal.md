# Proposal: EPIC-005 — Static Analysis Engine

## Intent

DevLens syncs repos but cannot understand them. Downstream capabilities (graph, metrics, search, docs, AI) need a canonical, language-independent model of the codebase. EPIC-005 implements RFC-006: a deterministic pipeline transforming snapshots into an immutable Intermediate Representation (IR), published via domain events.

## Scope

### In Scope

- Language detection (extension-based)
- Parser abstraction: `LanguageParser` + `ParserRegistry` (strategy); TypeScript parser via ts-morph (NestJS decorator classification)
- Immutable IR model: Project/Package/Module/Class/Interface/Function/Method/Endpoint/Dependency/Relationship
- TS AST → IR builder + validator (structural, relationship, referential integrity)
- `StaticAnalysisService`: snapshot → detect → parse → build → validate → persist → publish
- Incremental analysis (content-hash manifest, delta re-parse)
- Events `analysis.started/completed/failed`; `DomainEventDispatcher.registerHandler`
- BullMQ `analysis` queue; `repository.synchronized` handler enqueues
- Prereqs: export `SnapshotRepository`, `typescript` → deps, add `ts-morph`

### Out of Scope

- Graph (EPIC-006), Visualization (EPIC-007), AI (EPIC-008), Docs (EPIC-009), Search (EPIC-010), Metrics (EPIC-011)
- Go/Python parsers (architecture-ready, not built)

## Capabilities

### New Capabilities

- `language-detection`: extension→language mapping
- `parser-abstraction`: `LanguageParser`, `ParserRegistry`, parse-result contract
- `typescript-parser`: ts-morph adapter, NestJS decorator classification
- `intermediate-representation`: IR model, TS→IR builder, validator
- `static-analysis-pipeline`: orchestration, persistence, BullMQ, trigger, events, dispatcher extension
- `incremental-analysis`: hash manifest, partial re-parse

### Modified Capabilities

None — `openspec/specs/` empty.

## Approach

Per RFC-006: `ParserRegistry` maps language → `LanguageParser`; TS parser wraps ts-morph. IR is immutable value objects with explicit relationships; builder walks the AST; validator blocks invalid publication. Event-driven: `RepositorySynchronizedEvent` → `registerHandler` → BullMQ job → `StaticAnalysisService` → persist IR → `analysis.completed`. Incremental: per-file hash manifest; only changed files re-parse.

## Chained PR Strategy

Feature-branch chain (PR #1 targets feature branch; children target prior). Budget: 400 lines/slice.

| #   | Scope                                                                  | Finish                       | Verify                           |
| --- | ---------------------------------------------------------------------- | ---------------------------- | -------------------------------- |
| C1  | Detection + parser abstraction + ts-morph + `registerHandler` + events | Deterministic AST parse      | Unit tests, build                |
| C2  | IR model + builder + validator                                         | Valid IR for fixture         | Round-trip + validator tests     |
| C3  | Service + persistence + BullMQ + wiring + repo export                  | Snapshot → IR → event        | E2E: sync → `analysis.completed` |
| C4  | Incremental + NestJS discovery                                         | Delta re-parse + endpoint IR | Reuse-ratio tests                |

## Affected Areas

| Area                                          | Impact   | Description                     |
| --------------------------------------------- | -------- | ------------------------------- |
| `shared/domain/domain-event-dispatcher.ts`    | Modified | Add `registerHandler`           |
| `modules/repositories/repositories.module.ts` | Modified | Export `SnapshotRepository`     |
| `src/backend/package.json`                    | Modified | `typescript` → deps; `ts-morph` |
| `modules/static-analysis/`                    | New      | 3-layer context                 |
| `shared/shared.module.ts`                     | Modified | Wire handlers                   |

## Risks

| Risk                      | Likelihood | Mitigation                                 |
| ------------------------- | ---------- | ------------------------------------------ |
| ts-morph cost / API drift | Med        | Minimal API surface; perf tests            |
| Event ordering            | Low        | BullMQ decouples; idempotent by snapshotId |
| IR schema churn later     | Med        | Immutable + extensible; versioned events   |
| Incremental rename/delete | Med        | Manifest + full re-parse fallback          |

## Rollback Plan

1. Revert slice merge (per-slice revert point)
2. Disable `analysis` processor + handler (feature flag)
3. Drop `analysis_*` tables (no consumers yet)
4. `pnpm -r build && pnpm -r test`

## Dependencies

- EPIC-001–004 (foundation, core, identity, repositories/snapshots)
- Prereqs: export `SnapshotRepository`; `typescript` → deps; `ts-morph`
- RFC-003 (kernel), RFC-004 (events), RFC-006 (pipeline + IR)

## Success Criteria

- [ ] Sync triggers automatic analysis via BullMQ
- [ ] TS fixture yields deterministic, valid IR
- [ ] NestJS decorators classified (controller/service/endpoint)
- [ ] Invalid IR never published
- [ ] One-file change re-parses only that file (reuse ratio > 0)
- [ ] `analysis.completed` fires; sync flow unaffected
- [ ] All slices within 400-line budget
