# Proposal: EPIC-006 — Knowledge Graph

## Intent

DevLens produces IR but can't answer dependency questions. EPIC-006 implements RFC-007: a 3-stage pipeline (IR → Semantic Model → Knowledge Graph) persisting a typed, versioned graph in PostgreSQL, triggered by `analysis.completed`, enabling EPIC-007–011.

## Scope

### In Scope

- `knowledge-graph/` bounded context (domain/application/infrastructure)
- Node types: Project, Package, Module, Controller, Service, Repository, Entity, DTO, Interface, Endpoint, Event, ExternalDependency, Unknown
- Edge types: BELONGS_TO, DEPENDS_ON, IMPLEMENTS, EXTENDS, EXPOSES
- Semantic Model builder (transient; name/path heuristics; unclassified → Unknown)
- Graph builder (integrity validation)
- Persistence: `graph_nodes`, `graph_edges`, `graph_snapshots` (JSONB properties)
- `analysis.completed` handler → BullMQ → `KnowledgeGraphService`; idempotency; incremental updates (`deprecated_at`); versioned snapshots
- `GraphQueryService` + controller (dependencies, dependents, neighbors, paths)
- Upstream: export `AnalysisRepository`; resolve `workspaceId`

### Out of Scope

- EPIC-007–011 (visualization, AI, docs, search, metrics)
- IR-level DTO/Entity/Event classification; ACCEPTS/RETURNS/CALLS edges; graph DB; Redis caching

## Capabilities

### New Capabilities

- `knowledge-graph-model`: VOs, enums, SemanticModel, events, errors
- `knowledge-graph-construction`: Stages 1–2 builders + validation
- `knowledge-graph-persistence`: TypeORM entities, repos, migration, versioning
- `knowledge-graph-pipeline`: handler, BullMQ worker, orchestration, idempotency
- `knowledge-graph-query-api`: read-only query service + controller

### Modified Capabilities

None — upstream changes are implementation-level, not spec deltas.

## Approach

Per RFC-007: `analysis.completed` → `registerHandler` → BullMQ → load IR + snapshot → SemanticModelBuilder (roles/heuristics) → KnowledgeGraphBuilder (typed edges, integrity check) → persist transaction + snapshot row → publish `KnowledgeGraphBuilt`/`Updated`. Postgres relational (§10.1): UUID PKs, FQN unique per (repo, version); removed → `deprecated_at`; migration per shared migrations dir.

## Chained PR Strategy

Feature-branch chain (ask-always), 400 lines/slice.

| #   | Scope                                      | Finish                  | Verify      |
| --- | ------------------------------------------ | ----------------------- | ----------- |
| C1  | Domain model + export `AnalysisRepository` | Types defined           | Unit, build |
| C2  | Semantic Model + graph builders            | Valid fixture graph     | Round-trip  |
| C3  | Persistence + handler + BullMQ + wiring    | Event → graph rows      | E2E         |
| C4  | Incremental + snapshots + query API        | Delta updates + queries | Unit + E2E  |

## Affected Areas

| Area                       | Impact   | Description                 |
| -------------------------- | -------- | --------------------------- |
| `modules/static-analysis/` | Modified | Export `AnalysisRepository` |
| `modules/knowledge-graph/` | New      | 3-layer context             |
| `shared/.../migrations/`   | Modified | Graph tables migration      |

## Risks

| Risk                            | Likelihood | Mitigation                                |
| ------------------------------- | ---------- | ----------------------------------------- |
| IR lacks DTO/Entity/Event roles | High       | Heuristics + Unknown; limited v1 edge set |
| Redelivery duplicates version   | Med        | Idempotency by analysisId                 |
| Full rebuild cost               | Med        | FQN-stable diffing                        |
| `workspaceId` null in event     | Med        | Lookup via `RepositoryRepository`         |

## Rollback Plan

1. Revert per-slice (chained merge points)
2. Disable processor + handler (feature flag)
3. Drop `graph_*` tables (no consumers)
4. `pnpm -r build && pnpm -r test`

## Dependencies

- EPIC-001–005; RFC-007; `registerHandler` + `SnapshotRepository` exported
- Prereq: `AnalysisRepository` export; `workspaceId` resolution

## Success Criteria

- [ ] `analysis.completed` auto-builds and persists graph
- [ ] Fixture IR yields valid typed nodes/edges
- [ ] No duplicate versions on redelivery
- [ ] Removed concepts deprecated, not deleted
- [ ] Query API answers dependencies/dependents/paths
- [ ] Slices within 400-line budget
