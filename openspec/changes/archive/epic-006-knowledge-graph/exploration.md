# Exploration: EPIC-006 — Knowledge Graph

**Date:** 2026-08-04
**Sources read:** RFC-006/007, EPIC-005/006 docs, `analysis/` module (full), `repositories/` module (reference), `shared/` kernel, docker-compose, package.json, test suite.

---

## 1. IR Shape Analysis — What EPIC-006 Receives

### 1.1 Current IR structure (`ir-nodes.ts` + `typescript-ir-builder.ts`)

The IR is a tree of immutable value objects with explicit FQNs and flat edge lists:

| Node             | Fields                                                                                | FQN pattern                       |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| `IrProject`      | name, rootPath, language, packages[], dependencies[], relationships[]                 | `{projectName}` (= snapshotId)    |
| `IrPackage`      | name, version, modules[]                                                              | `{project}:{pkg}`                 |
| `IrModule`       | name, path, classes[], interfaces[], functions[]                                      | `{packageFqn}:{module}`           |
| `IrClass`        | name, isAbstract, isExported, **role**, extends, implements[], methods[], endpoints[] | `{moduleFqn}#{ClassName}`         |
| `IrInterface`    | name, isExported                                                                      | `{moduleFqn}#{Iface}`             |
| `IrFunction`     | name, isAsync, isExported                                                             | `{moduleFqn}#{fn}`                |
| `IrMethod`       | name, visibility, isStatic, parameters[]                                              | `{classFqn}.{method}`             |
| `IrEndpoint`     | name, httpMethod (UPPER), path, parameters[]                                          | `{classFqn}.{METHOD}:{path}`      |
| `IrDependency`   | source, target, type                                                                  | `{src}->{tgt}` (flat list)        |
| `IrRelationship` | kind, from, to                                                                        | `{from}->{to}:{kind}` (flat list) |

### 1.2 What the IR actually carries today

- **Roles** (via `decorator-role-registry.ts`): `module`, `controller`, `service`, `repository`, `exception-filter`, `guard`, `middleware`, `gateway`, `event-handler`, `message-handler` — produced from NestJS decorators.
- **Relationships** (only 2 kinds today): `extends`, `implements` — class→class / class→interface, only for _resolved internal_ references.
- **Dependencies**: flat module-level edges, `type: 'import'` only. Targets may be internal FQNs **or unresolved external specifiers** (`rxjs`, `@nestjs/common` — not in node set).
- **Endpoints**: attached to classes, `httpMethod + path + parameters[]` (parameter _names_ only, no types).
- **No** DTO/Entity/ValueObject/Event/Command/Query/ExternalService classification yet — `role` is `null` for classes without recognized decorators.
- **Incremental IR**: EPIC-005 already produces merged IR (kept modules + re-parsed), flat edges recomputed. `reuseRatio` tracks reuse.

### 1.3 Gaps between IR and RFC-007 semantic model

| RFC-007 wants                     | IR provides today                | Gap                                                |
| --------------------------------- | -------------------------------- | -------------------------------------------------- |
| Controller/Service/Module         | ✅ via `role`                    | none                                               |
| Endpoint                          | ✅ `IrEndpoint` (no DTO types)   | ACCEPTS/RETURNS edges can't be derived from types  |
| Entity/DTO/ValueObject            | ❌ role=null                     | needs name-convention heuristics or classification |
| Event/EventProducer/EventConsumer | ⚠️ `event-handler` role only     | no producer detection                              |
| ExternalService/SDK               | ⚠️ unresolved dependency targets | node creation possible (specifier-based)           |
| BoundedContext/Aggregate/Domain   | ❌                               | needs folder/name heuristics                       |
| DatabaseTable                     | ❌                               | not in IR                                          |
| IMPORTS/DEPENDS_ON/CALLS          | ⚠️ only `import`                 | CALLS needs method-level analysis (absent)         |

**Conclusion**: EPIC-006 must build the Semantic Model from _roles + relationships + dependency edges + name/file-path heuristics_, and classify unknown classes as `Unknown` per RFC-007 §6.4. The `IMPORTS` dependency edge maps naturally to `DEPENDS_ON`.

---

## 2. Graph Storage Recommendation

### 2.1 Options assessed

| Option                                                             | Verdict                                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL relational** (nodes + edges tables, JSONB properties) | ✅ **Recommended** — RFC-007 §10.1 prescribes exactly this; matches existing TypeORM stack; no new infra                                        |
| JSONB single-document                                              | ❌ — no relational integrity, no incremental edge updates, unindexable traversals, violates §10.1                                               |
| Neo4j / dedicated graph DB                                         | ❌ — NOT in docker-compose, no driver in package.json, no RFC mandate (RFC-007 explicitly says PostgreSQL); heavy ops burden for monolith scope |
| Redis-only graph                                                   | ❌ — ephemeral, no historical snapshots, query API needs durable store                                                                          |

### 2.2 Recommended schema (RFC-007 §10.1 compliant)

```text
graph_nodes:      id uuid PK, type varchar(64), label varchar(255), properties jsonb,
                  fqn varchar(512) UNIQUE (per repo+snapshot), repo_id uuid, snapshot_id uuid,
                  source_analysis_id uuid, version int, deprecated_at timestamptz NULL,
                  created_at/updated_at
                  INDEX: (type), (label), GIN (properties), (repo_id, fqn)

graph_edges:      id uuid PK, type varchar(64) (BELONGS_TO, DEPENDS_ON, ...),
                  source_node_id uuid FK→graph_nodes, target_node_id uuid FK→graph_nodes,
                  properties jsonb, version int, created_at
                  INDEX: (source_node_id), (target_node_id), (type)

graph_snapshots:  id uuid PK, repository_id uuid, analysis_id uuid, commit_sha varchar(64),
                  node_count int, edge_count int, status varchar(32),
                  created_at
```

- **Versioning**: per-repository `version` counter; each new `analysis.completed` for the repo bumps version and creates a new `graph_snapshots` row.
- **Deprecation**: removed concepts → `deprecated_at` instead of hard delete (RFC-007 §8.2).
- **No materialized views / Redis caching** in v1 (RFC-007 mentions them but they are optional optimizations — defer to when consumers appear).
- **TypeORM**: `autoLoadEntities: true` — just register entities via `TypeOrmModule.forFeature`. Production uses `synchronize:false`; EPIC-005 has no migration infra pattern beyond `shared/infrastructure/persistence/migrations/` (one migration exists). Follow that pattern for the graph tables.

---

## 3. Proposed Module Structure

```
src/backend/src/modules/knowledge-graph/
├── knowledge-graph.module.ts        # OnModuleInit → registerHandler('analysis.completed')
├── knowledge-graph.tokens.ts        # GRAPH_QUEUE, GRAPH_DLQ, NODE_TYPE_REGISTRY
├── domain/
│   ├── index.ts
│   ├── graph-node.vo.ts             # GraphNode (id, type, label, properties, fqn, version)
│   ├── graph-edge.vo.ts             # GraphEdge (type, source, target, properties, version)
│   ├── graph-snapshot.vo.ts         # version, commitSha, nodeCount, edgeCount, status
│   ├── node-type.enum.ts            # Project, Package, Module, Controller, Service, Entity, DTO, Interface, Endpoint, Event, ExternalDependency, Unknown, ...
│   ├── edge-type.enum.ts            # BELONGS_TO, DEPENDS_ON, IMPLEMENTS, EXTENDS, EXPOSES, ...
│   ├── semantic-model.vo.ts         # intermediate normalization layer (project/package/module/class/endpoint/edges)
│   ├── graph-errors.ts
│   └── graph-events.ts              # KnowledgeGraphBuilt, KnowledgeGraphUpdated, KnowledgeGraphValidationFailed
├── application/
│   ├── semantic-model-builder.service.ts   # Stage 1: IR → SemanticModel (roles, heuristics)
│   ├── knowledge-graph-builder.service.ts  # Stage 2: SemanticModel → nodes + edges + validation
│   ├── knowledge-graph.service.ts          # orchestration: load IR → build → persist → publish
│   └── graph-query.service.ts              # read-only query API (dependencies, dependents, neighbors, paths)
├── infrastructure/
│   ├── events/knowledge-graph-event-handler.ts   # analysis.completed → enqueue graph job
│   ├── jobs/knowledge-graph.job-processor.ts      # BullMQ worker (retry → DLQ)
│   ├── persistence/repositories/graph-node.repository.ts
│   ├── persistence/repositories/graph-edge.repository.ts
│   ├── persistence/repositories/graph-snapshot.repository.ts
│   ├── persistence/typeorm/graph-node.typeorm-entity.ts
│   ├── persistence/typeorm/graph-edge.typeorm-entity.ts
│   └── persistence/typeorm/graph-snapshot.typeorm-entity.ts
```

---

## 4. Trigger Mechanism

**Pattern (proven by EPIC-005):** `KnowledgeGraphModule implements OnModuleInit` → `eventDispatcher.registerHandler('analysis.completed', handler)` → handler enqueues a BullMQ job on `knowledge-graph` queue (attempts:3, exponential backoff) → `KnowledgeGraphJobProcessor` calls `KnowledgeGraphService`.

```text
analysis.completed (AnalysisCompletedEvent: snapshotId, repositoryId, workspaceId, correlationId, analysisId)
        │
        ▼
KnowledgeGraphEventHandler.handle()
        │  (no IR in event payload — must fetch from AnalysisRepository)
        ▼
BullMQ enqueue { snapshotId, repositoryId, analysisId } → attempts:3, exponential backoff
        │
        ▼
KnowledgeGraphJobProcessor.process()
        │
        ▼
KnowledgeGraphService.build(snapshotId, repositoryId, analysisId)
  1. load Analysis (IR) via AnalysisRepository.findById(analysisId)
  2. load Snapshot (commitSha) via SnapshotRepository.findById (already exported)
  3. Stage 1: SemanticModelBuilder.build(ir) → SemanticModel
  4. Stage 2: KnowledgeGraphBuilder.build(semanticModel, previousVersion) → nodes+edges
  5. validate integrity (every edge references existing nodes)
  6. persist nodes/edges in one transaction + new graph_snapshot
  7. publish KnowledgeGraphBuilt/Updated
```

**Key facts verified:**

- `AnalysisCompletedEvent` does **NOT** carry the IR — handler must load it via `AnalysisRepository.findById(analysisId)`.
- `AnalysisModule` currently exports **only** `StaticAnalysisService` — EPIC-006 needs `AnalysisRepository` exported (or a read-only `AnalysisQuery` service). This is a **required cross-module change**.
- `SnapshotRepository` and `RepositoryRepository` are already exported from `RepositoriesModule` — commitSha and workspace scoping are reachable.
- Event ordering is safe: `analysis.completed` is dispatched _after_ IR is persisted (`await this.analysisRepository.save(analysis)` precedes `dispatchBatch`).

---

## 5. Key Design Decisions & Trade-offs

| Decision                         | Option A                                                | Option B                        | Recommendation                                                                                                                    |
| -------------------------------- | ------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Storage                          | Relational nodes/edges (JSONB props)                    | JSONB blob / Neo4j              | **A** — RFC-007 §10.1, stack fit                                                                                                  |
| Node identity                    | IR FQN as natural key                                   | Surrogate UUID                  | **FQN unique per (repo, version); UUID PK** — FQNs are stable across incremental analyses (EPIC-005 keeps them), enabling diffing |
| Semantic model persistence       | Transient in-memory only                                | Persisted table                 | **Transient** — RFC-007 §6 is a normalization layer; only graph + snapshots persist                                               |
| Incremental updates              | Diff IR → apply node/edge delta                         | Full rebuild per event          | **Diff-based** (RFC-007 §8) — IR FQN stability makes this tractable; removed nodes → `deprecated_at`                              |
| Node classification beyond roles | Name/path heuristics (XxxDto, XxxEntity, `src/domain/`) | Extend IR in EPIC-005           | **Heuristics in EPIC-006**, deferring IR changes; unknown → `Unknown` node type                                                   |
| Query API                        | Dedicated `GraphQueryService` + controller              | Direct DB access from consumers | **A** — RFC-007 §9 read-only API, paginated, versioned                                                                            |
| Events                           | `KnowledgeGraphBuilt`/`Updated`                         | none                            | **A** — downstream consumers (RFC-007 §11)                                                                                        |
| Migrations                       | `shared/infrastructure/persistence/migrations/`         | TypeORM synchronize             | **Migrations file** — matches existing single-migration pattern, safe in prod                                                     |

---

## 6. Slicing Assessment — 4 slices like EPIC-005?

**Yes — 4 slices fits, matching EPIC-005's chained-PR pattern (C1–C4, ~400 lines/slice).**

| #   | Scope                                                                                           | Finish condition                        | Verify                                               |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| C1  | Domain model: node/edge/snapshot VOs, type enums, errors, events + export AnalysisRepository    | Graph domain types defined, unit-tested | Unit tests, build                                    |
| C2  | Semantic Model builder + Knowledge Graph builder (Stage 1+2)                                    | Valid nodes/edges for fixture IR        | Round-trip tests over `test/fixtures/mini-nestjs` IR |
| C3  | Persistence (3 TypeORM entities, repos, migration) + event handler + BullMQ queue + wiring      | analysis.completed → graph persisted    | E2E: sync → analysis.completed → graph rows          |
| C4  | Incremental updates (diff, deprecate) + snapshots/versioning + `GraphQueryService` + controller | Graph queries + delta-only updates      | Unit + E2E; reuse of EPIC-005 fixtures               |

**Caveat**: if Node classification heuristics (C2) or the query API (C4) grow, split into **5 slices** (C4a incremental+snapshots, C4b query API). EPIC-005 shipped 28 tasks/4 slices; EPIC-006 is comparable but has _more_ persistence surface (3 tables) and a query API — plan for 28–34 tasks.

---

## 7. Risks & Dependencies

### Dependencies (hard prerequisites)

- ✅ EPIC-005 IR shape is fixed and validated (`IrValidator` blocks invalid IR publication)
- ✅ `DomainEventDispatcher.registerHandler` exists (used by AnalysisModule)
- ✅ `SnapshotRepository` exported (commitSha for versioning)
- ⚠️ **`AnalysisRepository` NOT exported** — must add to `AnalysisModule.exports` (small, required change)
- ⚠️ `workspaceId` in `analysis.completed` is currently `null` (StaticAnalysisService passes `null`) — workspace-scoped querying (RFC-007 §14) needs either event payload fix or repo lookup via `RepositoryRepository` (has `workspaceId`/`organizationId`)

### Risks

| Risk                                                        | Likelihood | Mitigation                                                                |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| IR role coverage incomplete (DTO/Entity/Event absent)       | High       | Name/path heuristics + `Unknown` classification; defer rich node types    |
| ACCEPTS/RETURNS/CALLS edges impossible (no type info in IR) | High       | Only `BELONGS_TO`, `DEPENDS_ON`, `IMPLEMENTS`, `EXTENDS`, `EXPOSES` in v1 |
| Full rebuild cost on incremental IR                         | Med        | FQN-stable diffing; reuseRatio signals reuse                              |
| `analysis.completed` no IR payload → extra DB read per job  | Low        | `findById(analysisId)` — single indexed lookup                            |
| Event redelivery → duplicate graph version                  | Med        | Idempotency: skip if snapshot for analysisId exists                       |
| Graph size/perf at 100K nodes                               | Low        | Indexes per §2.2; recursive CTE for traversal; Redis cache deferred       |
| EPIC-006 consumers (RFC-008…) not yet built                 | Low        | Query API defined but consumers arrive later — no blocking issue          |

---

## Ready for Proposal

**Yes** — exploration complete. Sufficient data for `sdd-propose` to define EPIC-006 scope. Or orchestrator should tell the user: storage = Postgres relational (per RFC-007 §10.1, no Neo4j), 4–5 slices, with two required upstream touches (`AnalysisRepository` export; decide workspaceId handling).
