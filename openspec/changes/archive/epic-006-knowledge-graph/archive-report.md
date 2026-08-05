# Archive Report — EPIC-006 Knowledge Graph

**Change:** `epic-006-knowledge-graph`
**Archived:** 2026-08-04
**Branch:** `feat/knowledge-graph` (slices C1–C4 applied in one squash commit)
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (5 capability specs)

---

## Completion Summary

| Metric         | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| Status         | **COMPLETED**                                                |
| Tasks          | 27 across 4 slices (C1–C4, chained PRs #1–#4)                |
| Unit tests     | 440 passing (60 suites)                                      |
| KG-specific    | 186 tests (24 suites) + 27 e2e (6 suites)                    |
| Type check     | ✅ `tsc --noEmit` clean                                      |
| Build          | ✅ `nest build` exit 0                                       |
| Lint           | ✅ 0 errors, 0 warnings (changed files)                      |
| Coverage       | ➖ No coverage threshold configured (project-level)          |
| Verify verdict | **PASS WITH WARNINGS** — 0 CRITICAL, 6 WARNING, 5 SUGGESTION |

> Note: the verify report's per-spec tables enumerate W1–W9 findings (9 rows) while the
> header states 6 WARNING — a labeling inconsistency in the verify report itself, not a
> functional gap. All findings are non-blocking and documented below.

## Capabilities Delivered

| Domain                       | Spec file (global)                                    |
| ---------------------------- | ----------------------------------------------------- |
| knowledge-graph-model        | `openspec/specs/knowledge-graph-model/spec.md`        |
| knowledge-graph-construction | `openspec/specs/knowledge-graph-construction/spec.md` |
| knowledge-graph-persistence  | `openspec/specs/knowledge-graph-persistence/spec.md`  |
| knowledge-graph-pipeline     | `openspec/specs/knowledge-graph-pipeline/spec.md`     |
| knowledge-graph-query-api    | `openspec/specs/knowledge-graph-query-api/spec.md`    |

All 4 spec files for model (8/8), construction (6/6), and persistence (6/6) requirements
are fully compliant; query-api is 11/14 COMPLIANT with 3 PARTIAL scenarios (see W8/W9).

## What Was Built

A new `knowledge-graph` bounded context in the modular monolith:

1. **Domain model** (C1): `NodeType` (12 values), `EdgeType` (6), `BuildStatus` enums;
   `GraphNode`/`GraphEdge` value objects with `toJSON`/`reconstitute`; `GraphSnapshot`
   entity; transient `SemanticModel`; `KnowledgeGraphBuilt`/`Updated`/`BuildFailed`
   domain events; 7 typed errors.
2. **Builders** (C2): `SemanticModelBuilder` (role map + 9 heuristics + Unknown fallback,
   full IR traversal), `GraphBuilder` (deterministic SHA-1-seeded UUIDs, integrity
   validation — dangling/self/dup edges dropped, orphans kept), static pure query
   functions.
3. **Persistence + pipeline** (C3): TypeORM entities + migration
   `1785888000000-CreateKnowledgeGraphTables` (GIN on properties, composite unique
   `(fqn, repo_id, version)`, unique `analysis_id`, CASCADE FKs); transactional
   `GraphRepository.saveGraph`; 7-stage `KnowledgeGraphService.build`; BullMQ
   `knowledge-graph` queue (3 attempts, exponential backoff, DLQ) + `analysis.completed`
   handler; module wiring with `OnModuleInit` registration.
4. **Incremental + query API** (C4): delta updates (absent FQNs → `deprecated_at = now`,
   previous version intact, monotonic version bump); `GraphQueryService` instance
   methods with pagination (`{data, total}`, default 50, max 200) and version filter;
   `GraphController` (`/api/v1/graph/:repoId`, `/nodes`, `/nodes/:fqn`, `/edges`)
   with class-validator DTOs (400/404, JSON-safe).

Upstream: `AnalysisRepository` exported from `AnalysisModule`; `SnapshotRepository`
already exported.

## Verification Result

- **Verdict**: PASS WITH WARNINGS
- **Tests**: 440 passing across 60 suites (all green); 0 TypeScript errors; `nest build` succeeds.
- **Compliance**: model 8/8 req, construction 6/6, persistence 6/6, pipeline PASS,
  query-api 11/14 (3 PARTIAL: neighborhood direction, multi-type filter, repo access).

## Key Decisions (from design.md / apply-progress)

1. **GraphSnapshot as AggregateRoot** (not VO) — needs identity + lifecycle for DB persistence; the spec title says "Value Object" but all functional requirements hold (W1).
2. **Edge derivation in `SemanticModelBuilder`** — `GraphBuilder` only resolves FQNs → deterministic UUIDs + integrity; all 6 spec derivation rules still satisfied (W2).
3. **Deterministic UUIDs via `reconstitute()`** — SHA-1 seeded by `repo:version:fqn`; pipeline output is byte-identical per spec (replaces `randomUUID`).
4. **Idempotency at service level** — snapshot-exists check in `KnowledgeGraphService`, the authoritative point; event handler does not pre-check (W4).
5. **Transactional all-or-nothing persistence** — failed builds leave zero rows; `snapshot.fail()` on in-memory aggregate + `GraphBuildFailedEvent`; BullMQ retry/DLQ for recovery (S4).
6. **Always-bump version** — same FQN set builds at `previous + 1` (no-op upgrade) because the composite unique constraint rejects same-version re-inserts; version history stays monotonic.
7. **Job payload `{ analysisId }` only** — service derives everything else; spec's `{snapshotId, repositoryId, analysisId}` payload simplified (W5).
8. **No `@Process()` decorator** — @nestjs/bullmq 10.2 doesn't export it; uses `WorkerHost.process()` override, same as `AnalysisJobProcessor` (W6).
9. **`source_analysis_id` added to `graph_nodes`** — spec-required; populated from `snapshot.analysisId` in `saveGraph`.
10. **Feature-branch chain** — 4 slices C1–C4, PRs #1–#4 on `feat/knowledge-graph`; total ~2050 lines forecast, all slices shipped.

## Deviations (documented during apply)

1. **NodeType 12 values incl. Package + Interface** — apply prompt listed 10; spec/design list 12.
2. **BuildStatus `pending/building/built/failed`** — apply prompt used CREATED/COMPLETED; design + persistence spec DB values win.
3. **Edge derivation location** (C2) — semantic builder instead of graph builder; spec scenarios still pass.
4. **EXPOSES for all owning classes** (C2) — not limited to Controller-role; spec's controller scenario still satisfied.
5. **No `@Process()` decorator** (C3) — library limitation, behavior identical.
6. **Job payload `{ analysisId }`** (C3) — prompt-simplified; service only needs it.
7. **Handler doesn't pre-check idempotency** (C3) — deferred to service (authoritative).
8. **`@Unique` (fqn, repo_id, version)** — entity constraint + `TableUnique` in migration instead of an index; same Postgres enforcement.
9. **Snapshot persisted BUILT inside the transaction** — nodes/edges/snapshot land atomically with final counts; no post-transaction update.
10. **FAILED snapshot never persisted** — all-or-nothing transaction leaves zero rows by design (spec rollback scenario).
11. **Always-bump version** (C4) — no same-version rebuild short-circuit; monotonic history.
12. **Version filter added beyond apply prompt** — required by tasks.md + query-api spec; implemented as optional `version` param.
13. **`@Controller({ path: 'graph', version: '1' })`** — avoids double prefix with existing `setGlobalPrefix('api')` + URI versioning; final route exactly `/api/v1/graph/...`.
14. **No JWT guard on GraphController** — no repo-membership service exists; flagged for follow-up (S5).
15. **`findEdges` repo scoping** — edges have no `repo_id` column; resolves repo's node ids at version and filters `sourceNodeId IN (...)`.

## Warnings (from verify-report — all non-blocking)

1. **W1** GraphSnapshot implemented as AggregateRoot, spec §4 titles it "Value Object" — functional requirements fully satisfied.
2. **W2** Edge derivation in `SemanticModelBuilder` vs spec's `GraphBuilder` attribution — behavioral requirements satisfied.
3. **W3** EXPOSES produced from any owning class, not limited to Controller-role — spec scenario still passes.
4. **W4** Event handler defers idempotency pre-check to `KnowledgeGraphService` — behavior identical, no duplicate builds.
5. **W5** Job payload `{ analysisId }` only vs spec's `{ snapshotId, repositoryId, analysisId }` — service only needs analysisId.
6. **W6** No `@Process()` decorator — library limitation, identical behavior.
7. **W7** No `@ManyToOne`/`@JoinColumn` on `GraphEdgeEntity` — FKs only in migration DDL; DB handles CASCADE; nodes are soft-deprecated, never hard-deleted.
8. **W8** Neighborhood direction not exposed in REST — static core supports it; endpoint returns both directions.
9. **W9** Multi-type filter not in REST — DTO accepts single `string`; static method accepts `NodeType[]`.

## Suggestions (from verify — for future reference)

- **S1** Update spec title "Value Object" → "AggregateRoot" for GraphSnapshot (done in archived synced spec via implementation note).
- **S2** Unify `IrInterface` and `I[A-Z]*` heuristic — two code paths, same result.
- **S3** `findLatestByRepo` loads ALL nodes to compute `Math.max(version)` in JS — a `SELECT MAX(version)` would scale better.
- **S4** Spec requirement says "snapshot status set to failed" but scenario says "zero snapshots persisted" — language tension; implementation follows the scenario.
- **S5** No JWT guard on GraphController — known follow-up (auth + repo-scoped authorization).

## Follow-ups Identified

| #   | Follow-up                                                      | Source                     |
| --- | -------------------------------------------------------------- | -------------------------- |
| 1   | JWT guard + repo-membership authorization on `GraphController` | S5 / spec §Error Responses |
| 2   | `includeDeprecated` opt-in query param                         | C4 apply-progress          |
| 3   | Snapshot version list endpoint (`/graph/versions`)             | C4 apply-progress          |
| 4   | Neighborhood direction + multi-type filter in REST DTOs        | W8/W9                      |
| 5   | `SELECT MAX(version)` optimization in `findLatestByRepo`       | S3                         |
| 6   | Unify `IrInterface`/`I[A-Z]*` classification path              | S2                         |

## Artifacts in This Archive

- `proposal.md` — intent, scope, approach, chained PR strategy, risks, rollback
- `design.md` — architecture decisions, domain model, pipeline data flow, per-slice design
- `tasks.md` — 27 tasks across C1–C4 (all `[x]`)
- `apply-progress.md` — per-task TDD evidence (C1–C4), deviations, gotchas
- `verify-report.md` — completeness, test execution, spec compliance matrix, verdict
- `specs/` — 5 delta specs (knowledge-graph-model, knowledge-graph-construction, knowledge-graph-persistence, knowledge-graph-pipeline, knowledge-graph-query-api)
- `exploration.md` — pre-proposal exploration (schema, trigger mechanism, key decisions)
- `archive-report.md` — this report

## Next Steps

- Address follow-ups #1–#4 (auth guard, deprecated opt-in, versions endpoint, REST direction/multi-type) as a small follow-up change.
- Downstream epics (EPIC-007 visualization, EPIC-008 AI, EPIC-009 docs, EPIC-010 search, EPIC-011 metrics) can consume the synced `openspec/specs/knowledge-graph-*` capabilities.
- EPIC-006 tracking doc status updated to **Completed**.
