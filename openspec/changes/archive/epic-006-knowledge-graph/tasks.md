# Tasks: EPIC-006 — Knowledge Graph

## Review Workload Forecast

| Slice | Est lines | 400-risk | PR  |
| ----- | --------- | -------- | --- |
| C1    | ~400      | Medium   | #1  |
| C2    | ~430      | Medium   | #2  |
| C3    | ~750      | High     | #3  |
| C4    | ~470      | Med-High | #4  |
| Total | ~2050     | High     | 4   |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

C3 exceeds the 400-line budget; split into C3a (persistence + migration, PR #3) and C3b (pipeline + wiring + E2E, PR #3b) if the reviewer objects to the full slice.

## Suggested Work Units

| Unit | Goal                                        | Likely PR                         | Notes                      |
| ---- | ------------------------------------------- | --------------------------------- | -------------------------- |
| C1   | Domain model + export AnalysisRepository    | #1 (base: `feat/knowledge-graph`) | VOs, enums, events, errors |
| C2   | Builders + query service                    | #2 (base: #1)                     | Fixture round-trip         |
| C3a  | Entities + migration + GraphRepository      | #3 (base: #2)                     | Transactional saveGraph    |
| C3b  | Service + handler + processor + wiring      | #3b (base: #3)                    | Pipeline E2E               |
| C4   | Incremental + query controller + pagination | #4 (base: #3b)                    | Delta + REST API           |

## Conventions

KG = `src/backend/src/modules/knowledge-graph/`. Layers (D/A/I/K). Tests mirror at `src/backend/test/unit/modules/knowledge-graph/{layer}/`; E2E at `src/backend/test/e2e/knowledge-graph/`. Strict TDD: write failing spec (RED) before impl (GREEN), refactor after. No comments in code. Verify per slice: `pnpm -r build`, `pnpm -r test`, lint.

## Phase 1 — C1 Domain Model (PR #1)

- [x] 1.1 (D) `domain/node-type.enum.ts` + `edge-type.enum.ts` + `build-status.enum.ts`; spec: exact enum values
- [x] 1.2 (D) `domain/graph-node.vo.ts`; spec: create/equality/toJSON, FQN stable across versions. Dep: 1.1
- [x] 1.3 (D) `domain/graph-edge.vo.ts`; spec: requires source/target/version. Dep: 1.1
- [x] 1.4 (D) `domain/graph-snapshot.vo.ts`; spec: status lifecycle, counts. Dep: 1.1
- [x] 1.5 (D) `domain/semantic-entry.ts` + `semantic-model.vo.ts`; spec: one entry per IR node, deps pass-through. Dep: 1.1
- [x] 1.6 (D) `domain/graph-errors.ts`; spec: InvalidNodeType/DuplicateNode/DanglingEdge/GraphIntegrity carry code + message. Dep: 1.1
- [x] 1.7 (D) `domain/graph-events.ts`; spec: Built/Updated implement DomainEvent with repositoryId + snapshotId + analysisId. Dep: 1.4
- [x] 1.8 (D) `domain/index.ts` barrel. Dep: 1.2–1.7
- [x] 1.9 (K) `src/backend/src/modules/analysis/analysis.module.ts` add `AnalysisRepository` to exports. Dep: 1.8
- [x] Verify: build, unit, lint

## Phase 2 — C2 Builders + Query (PR #2)

- [x] 2.1 (A) `application/semantic-model-builder.service.ts`; spec: role map, heuristics (Dto/Entity/`entities|domain` dirs/`I[A-Z]*`), Unknown fallback, 11-entry tree. Dep: 1.5
- [x] 2.2 (A) `application/graph-builder.service.ts`; spec: node per entry, 6 edge derivations, dangling dropped + warned, orphan kept, byte-identical re-run. Dep: 1.2, 1.3, 2.1
- [x] 2.3 (A) `application/graph-query.service.ts`; spec: getLatestByRepo, getNodeByFqn (null on miss), getNeighborhood(direction), getEdges(type filter). Dep: 2.2
- [x] 2.4 (A) round-trip spec `application/graph-builder.roundtrip.spec.ts` — fixture `test/fixtures/mini-nestjs` → typed nodes + edges. Dep: 2.2
- [x] Verify: build, unit, lint

## Phase 3 — C3 Persistence + Pipeline (PR #3)

- [x] 3.1 (I) `infrastructure/persistence/typeorm/graph-node.typeorm-entity.ts`; spec: columns, @Index type, @Unique (fqn, repo_id, version), JSONB. Dep: 1.2
- [x] 3.2 (I) `.../graph-edge.typeorm-entity.ts` + `.../graph-snapshot.typeorm-entity.ts`; spec: non-null FKs, @Unique analysis_id. Dep: 1.3, 1.4
- [x] 3.3 (K) migration `src/backend/src/shared/infrastructure/persistence/migrations/1785888000000-CreateKnowledgeGraphTables.ts`; spec: 3 tables, indexes, FKs, uniques. Dep: 3.1, 3.2
- [x] 3.4 (I) `infrastructure/persistence/repositories/graph.repository.ts`; spec: saveGraph transactional rollback, existsByAnalysisId, findSnapshotsByRepoId, unique/FK violations. Dep: 3.1–3.3
- [x] 3.5 (A) `application/knowledge-graph.service.ts`; spec: 7-stage build, idempotent skip, Built vs Updated event. Dep: 2.2, 3.4
- [x] 3.6 (I) `infrastructure/jobs/knowledge-graph.job-processor.ts`; spec: retry 3 + exponential backoff, DLQ routing. Dep: 3.5
- [x] 3.7 (I) `infrastructure/events/knowledge-graph-event-handler.ts`; spec: enqueue on `analysis.completed` with analysisId/snapshotId/repositoryId, skip if snapshot built. Dep: 3.6
- [x] 3.8 (I) `knowledge-graph.tokens.ts` + `knowledge-graph.module.ts`; spec: forFeature, registerQueue, RepositoriesModule + AnalysisModule imports, OnModuleInit registerHandler. Dep: 3.5–3.7
- [x] 3.9 (K) `src/backend/src/app.module.ts` register KnowledgeGraphModule. Dep: 3.8
- [x] 3.10 (E2E) `test/e2e/knowledge-graph/pipeline.e2e-spec.ts` — seed analysis, dispatch `analysis.completed`, assert graph_nodes/edges/snapshots rows. Dep: 3.8, 3.9
- [x] Verify: build, unit, e2e, lint

## Phase 4 — C4 Incremental + Query API (PR #4)

- [x] 4.1 (A) `application/knowledge-graph.service.ts` incremental delta; spec: repo-v1→repo-v2, new nodes inserted, absent deprecatedAt=now, previous version intact, edges rebuilt, version bump. Dep: 3.5
- [x] 4.2 (A) `application/graph-query.service.ts` pagination + version filter + deprecated exclusion; spec: limit default 50/max 200, offset, `{data, total}`. Dep: 2.3
- [x] 4.3 (I) `graph.repository.ts` query methods findNodesByVersion, findEdges, neighborhood, paginated; integration spec. Dep: 3.4, 4.2
- [x] 4.4 (I) `infrastructure/graph.controller.ts` REST endpoints; spec: latest, versions/:version, nodes/:fqn, neighborhood?direction, edges filters, 400 invalid type/negative limit, JSON-safe. Dep: 4.2, 4.3
- [x] 4.5 (E2E) `test/e2e/knowledge-graph/query-api.e2e-spec.ts` + incremental e2e (re-analyze same repo). Dep: 4.1, 4.4
- [x] Verify: build, unit, e2e, lint

## Dependency Graph

Cross-slice: C1→C2 (2.2 uses 1.2/1.3)→C3 (3.4 uses 3.1–3.3; 3.5 uses 2.2 + 3.4)→C4 (4.1 uses 3.5; 4.3 uses 3.4). Within-slice: deps inline, never forward. Chain: PR #1 base `feat/knowledge-graph`, #2 base #1, #3 base #2, #3b base #3, #4 base #3b; retarget if a child diff shows parent slices.
