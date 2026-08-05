# Design: EPIC-006 — Knowledge Graph

## Domain Model

```
GraphNode (VO)                 GraphEdge (VO)
├── id: string (UUID)          ├── id: string (UUID)
├── type: NodeType             ├── type: EdgeType
├── label: string              ├── sourceNodeId: string
├── fqn: string                ├── targetNodeId: string
├── properties: Record<...>    ├── properties: Record<...>
├── repoId: string             └── version: number
├── version: number
└── deprecatedAt: Date | null

GraphSnapshot (VO)             SemanticModel (VO — transient)
├── id: string                 ├── entries: SemanticEntry[]
├── repositoryId: string       └── dependencies: IrDependency[]
├── analysisId: string
├── commitSha: string          SemanticEntry { fqn, type: NodeType,
├── nodeCount: number            label, filePath, isExported, ... }
├── edgeCount: number
└── status: BuildStatus
```

**NodeType enum**: Project, Package, Module, Controller, Service, Repository, Entity, DTO, Interface, Endpoint, ExternalDependency, Unknown
**EdgeType enum**: BELONGS_TO, DEPENDS_ON, IMPLEMENTS, EXTENDS, EXPOSES, IMPORTS
**BuildStatus enum**: pending, building, built, failed

All domain objects follow the `ValueObject` base class pattern from `shared/domain/value-object.ts`. GraphNode and GraphEdge extend `ValueObject` — they are NOT entities or aggregate roots. The graph boundary has no aggregate root; the `KnowledgeGraphService` orchestrates persistence atomically. The `SemanticModel` is a transient VO discarded after graph construction.

## Pipeline Data Flow

```
analysis.completed event
        │
        ▼
KnowledgeGraphEventHandler.handle()
        │  enqueues { snapshotId, repositoryId, analysisId }
        ▼
BullMQ queue: knowledge-graph (attempts:3, exponential backoff)
        │
        ▼
KnowledgeGraphJobProcessor.process()
        │
        ▼
KnowledgeGraphService.build(repositoryId, analysisId)
  │
  ├─1─► AnalysisRepository.findById(analysisId)      → Analysis (IR)
  ├─2─► SnapshotRepository.findById(snapshotId)       → Snapshot (commitSha)
  ├─3─► SemanticModelBuilder.build(ir)                → SemanticModel
  ├─4─► GraphBuilder.build(semanticModel, prevVersion) → nodes[] + edges[]
  ├─5─► validate edge referential integrity
  ├─6─► GraphRepository.saveGraph(nodes, edges, snapshot) [TRANSACTION]
  └─7─► eventDispatcher.dispatch(KnowledgeGraphBuilt | Updated)
```

**Idempotency**: before step 1, check `GraphSnapshot.existsByAnalysisId(analysisId)`. Skip if status is `built`; retry if `failed`.
**Incremental (C4)**: load previous version's nodes, compare by FQN — new FQNs inserted, absent FQNs get `deprecatedAt = now()`, existing nodes carry forward unmodified.

## Module Structure

```
src/backend/src/modules/knowledge-graph/
├── domain/
│   ├── graph-node.vo.ts                # GraphNode value object
│   ├── graph-edge.vo.ts                # GraphEdge value object
│   ├── graph-snapshot.vo.ts            # GraphSnapshot value object
│   ├── semantic-entry.ts               # SemanticEntry (part of SemanticModel)
│   ├── semantic-model.vo.ts            # Transient normalization layer
│   ├── node-type.enum.ts               # NodeType string enum
│   ├── edge-type.enum.ts               # EdgeType string enum
│   ├── build-status.enum.ts            # BuildStatus enum
│   ├── graph-errors.ts                 # DuplicateNodeError, DanglingEdgeError, etc.
│   ├── graph-events.ts                 # KnowledgeGraphBuilt, KnowledgeGraphUpdated
│   └── index.ts
├── application/
│   ├── knowledge-graph.service.ts      # Orchestrator: load → build → persist → publish
│   ├── semantic-model-builder.service.ts # Stage 1: IR → SemanticModel
│   ├── graph-builder.service.ts        # Stage 2: SemanticModel → nodes + edges
│   └── graph-query.service.ts          # Read-only: getLatestByRepo, getNodeByFqn, getNeighborhood, getEdges
├── infrastructure/
│   ├── events/
│   │   └── knowledge-graph-event-handler.ts   # analysis.completed → enqueue
│   ├── jobs/
│   │   └── knowledge-graph.job-processor.ts    # BullMQ WorkerHost
│   ├── persistence/
│   │   ├── typeorm/
│   │   │   ├── graph-node.typeorm-entity.ts
│   │   │   ├── graph-edge.typeorm-entity.ts
│   │   │   └── graph-snapshot.typeorm-entity.ts
│   │   └── repositories/
│   │       └── graph.repository.ts             # saveGraph (transactional), query methods
├── knowledge-graph.module.ts           # OnModuleInit → registerHandler + TypeOrmModule.forFeature
├── knowledge-graph.tokens.ts           # GRAPH_QUEUE, GRAPH_DLQ
└── index.ts
```

## Per-Slice Breakdown

### C1: Domain Model + Upstream Export

**Files**: All `domain/*` files, `graph-errors.ts`, `graph-events.ts`, plus modification to `AnalysisModule.exports`.
**Upstream change**: Add `AnalysisRepository` to `AnalysisModule.exports` array (1 line).
**Finish**: All types compile, unit tests for VO creation and NodeType/EdgeType validation.
**Interfaces**: VOs expose `create()` and `toJSON()` like IR nodes. Events implement `DomainEvent`.

### C2: Builders + Query Service

**Files**: `semantic-model-builder.service.ts`, `graph-builder.service.ts`, `graph-query.service.ts`.
**Builder interface**:

```typescript
class SemanticModelBuilder {
  build(ir: IrProject): SemanticModel;
}
class GraphBuilder {
  build(model: SemanticModel, previousVersion: number): { nodes: GraphNode[]; edges: GraphEdge[] };
}
```

**Query interface**: `getLatestByRepo(repoId)`, `getNodeByFqn(fqn, version)`, `getNeighborhood(nodeId, direction?)`, `getEdges(nodeId, edgeType?)`.
**Heuristic mapping** per spec: `role → Controller/Service/Repository`, name ends with `Dto` → DTO, name ends with `Entity` or path under `entities/` → Entity, `I*` pattern → Interface, external import → ExternalDependency, else Unknown.
**Determinism**: builder methods are pure functions of IR input. No randomness, no external state.

### C3: Persistence + Event Handler + Job Processor + Wiring

**Files**: 3 TypeORM entities, `graph.repository.ts`, migration, event handler, job processor, tokens, module.
**TypeORM entities** mirror existing `AnalysisTypeOrmEntity` pattern: `@Entity`, `@PrimaryGeneratedColumn('uuid')`, `@Column`, `@CreateDateColumn`/`@UpdateDateColumn`, `@Index` decorators. Composite unique on `(fqn, repoId, version)` via `@Unique`.
**Repository**: single `GraphRepository` with `saveGraph(nodes, edges, snapshot)` — all 3 inserts wrapped in a TypeORM `dataSource.transaction`. Also `findSnapshotsByRepoId`, `findNodesByVersion`, etc.
**Migration**: follows `1735000000000-CreateExternalIdentities.ts` pattern — `MigrationInterface` with `createTable`/`createIndex`/`createUnique` via `queryRunner`. Named with epoch prefix.
**Wiring**: `KnowledgeGraphModule` imports `TypeOrmModule.forFeature([3 entities])`, `BullModule.registerQueue`, `RepositoriesModule` (for SnapshotRepository), `AnalysisModule` (for AnalysisRepository). `OnModuleInit` registers `analysis.completed` handler.

### C4: Incremental Updates + Query API Refinements

**Files**: Delta logic in `KnowledgeGraphService.build()`, enhanced `GraphQueryService` for version filtering and pagination, controller.
**Delta algorithm**: compare previous version's FQN set with new. Insert new nodes (bump `version`), mark missing nodes with `deprecatedAt`. Edges fully rebuilt per version — no edge-level diffing. Previous version's graph remains intact.
**Paginated queries**: `getNeighborhood` and `getEdges` support `limit` (default 50, max 200) and `offset`. Return `{ data: T[], total: number }`.
**Controller**: `GET /repositories/:repoId/graph/latest`, `GET /repositories/:repoId/graph/versions/:version`, `GET /repositories/:repoId/graph/nodes/:fqn`, `GET /graph/nodes/:nodeId/neighborhood?direction=incoming|outgoing|both`.

## Architecture Decisions

| Decision                   | Choice                                                         | Alternatives rejected                                                    | Rationale                                                                                                                                |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Domain objects as VOs      | GraphNode/Edge/Snapshot extend shared `ValueObject`            | Entities/aggregate roots with mutation methods                           | IR nodes already use VOs; graph objects are immutable snapshots; no identity lifecycle — version is the differentiator                   |
| Single repository class    | One `GraphRepository` with all DB methods                      | Per-entity repositories (GraphNodeRepository, GraphEdgeRepository, etc.) | Transaction across entities requires single coordination point; matches `AnalysisRepository` pattern (single repo handles analysis + IR) |
| FQN as natural key         | FQN + repoId + version unique constraint; UUID PK as surrogate | UUID-only or FQN-only                                                    | FQN stability enables cross-version diffing; UUID PK enables FK edges without embedding FQNs in edges                                    |
| Soft-deprecate over delete | `deprecatedAt` timestamp; active = NULL                        | Hard delete of removed nodes                                             | Historical queries require knowing what existed; matches RFC-007 §8.2                                                                    |
| No controller in C1-C3     | Defer API controller to C4                                     | Controller in C3                                                         | C4 is the query slice; controller is the presentation of query results                                                                   |
| Idempotency by analysisId  | Check snapshot before enqueue                                  | Dedup by job ID                                                          | AnalysisId is the source of truth — if IR was already built into graph, skip; simpler than job dedup                                     |

## Testing Strategy

| Layer          | What to Test                                         | Approach                                                                         | Slice |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | ----- |
| Domain VOs     | Creation, equality, toJSON, validation errors        | Jest unit tests with inline fixtures                                             | C1    |
| Builders       | Round-trip: fixture IR → SemanticModel → nodes+edges | Jest unit; fixture from `test/fixtures/mini-nestjs`; assert deterministic output | C2    |
| Query service  | All query methods return expected shape              | Jest unit with in-memory arrays (no DB)                                          | C2    |
| Repository     | CRUD, transaction rollback, unique constraint        | Integration test with test DB (TypeORM)                                          | C3    |
| Event handler  | Enqueue on event, skip idempotent                    | Jest unit with mocked queue                                                      | C3    |
| Job processor  | Invokes service, retries, DLQ routing                | Jest unit with mocked service                                                    | C3    |
| Pipeline E2E   | analysis.completed → graph rows in DB                | Integration: seed analysis → publish event → assert graph_nodes/edges/snapshots  | C3    |
| Incremental    | Delta only: deprecated nodes, new nodes              | Unit: compare two IR fixtures; E2E: re-analyze same repo                         | C4    |
| API controller | HTTP status codes, pagination, JSON safety           | SuperTest E2E                                                                    | C4    |
