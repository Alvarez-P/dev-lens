# knowledge-graph-model Specification

> **Archived from**: `epic-006-knowledge-graph` (2026-08-04)
> **Updated by**: `ai-enrichment` (2026-08-07) — added `sourceFile` tracking (Gap G1)
> **Updated by**: `request-flow-visualization` (2026-08-10) — `INVOKES`/`INJECTS` edge types, endpoint-level `PROTECTS`/`TRANSFORMS`, parameter-type `DEPENDS_ON`, `flowAvailable` on snapshots

## Purpose

Define the domain model for the Knowledge Graph bounded context: typed nodes, directed edges, transient semantic model, snapshots, errors, and domain events. Per RFC-007 §7, the graph is the single source of truth for all downstream capabilities.

## Requirements

### Requirement: Graph Node Types

The system SHALL classify every graph node into one of the following types:

| Type               | Source                      | Description                    |
| ------------------ | --------------------------- | ------------------------------ |
| Project            | IR root                     | Repository-level root node     |
| Package            | IR package                  | package.json / module grouping |
| Module             | IR module                   | File-level logical grouping    |
| Controller         | IR class (role: controller) | HTTP/gRPC/WS entry point       |
| Service            | IR class (role: service)    | Business logic class           |
| Repository         | IR class (role: repository) | Data access abstraction        |
| Entity             | Heuristic                   | Domain object with identity    |
| DTO                | Heuristic                   | Data transfer object           |
| Interface          | IR interface                | Contract definition            |
| Endpoint           | IR endpoint                 | Individual API operation       |
| ExternalDependency | IR dependency (unresolved)  | Third-party package or service |
| Unknown            | Fallback                    | Unrecognized concept           |

#### Scenario: Class with recognized role maps to typed node

- GIVEN an IR class with `role = 'controller'`
- WHEN the Semantic Model builder processes it
- THEN the resulting model entry has type `Controller`
- AND its FQN matches the IR class FQN

#### Scenario: Class without recognized role classified as Unknown

- GIVEN an IR class with `role = null` and name not matching any heuristic pattern
- WHEN the Semantic Model builder processes it
- THEN the resulting model entry has type `Unknown`

### Requirement: Graph Edge Types

The system SHALL model relationships using the following directed edge types:

| Edge       | Source                        | Target                 | Trigger                                                         |
| ---------- | ----------------------------- | ---------------------- | --------------------------------------------------------------- |
| BELONGS_TO | Any node                      | Module/Package/Project | Structural containment                                          |
| DEPENDS_ON | Any node                      | Any node               | Import statement OR parameter-type ref                          |
| IMPLEMENTS | Class                         | Interface              | `implements` clause                                             |
| EXTENDS    | Class                         | Class                  | `extends` clause                                                |
| EXPOSES    | Controller                    | Endpoint               | Method with HTTP decorator                                      |
| IMPORTS    | Module                        | ExternalDependency     | Unresolved external import                                      |
| PROTECTS   | Guard                         | Controller OR Endpoint | `@UseGuards` (class-level and endpoint-level)                   |
| TRANSFORMS | Pipe, Interceptor, Middleware | Controller OR Endpoint | `@UsePipes`/`@UseInterceptors` (class-level and endpoint-level) |
| INVOKES    | Controller, Service           | Service, Repository    | Constructor DI order (approximate)                              |
| INJECTS    | Any Class                     | Any Class              | Constructor injection                                           |

> **Edge semantics note**: `INVOKES` represents the approximate call chain (Controller→Service→Repository) derived from DI order + import reachability, carrying `properties.approximate = true`. It is NOT the Interceptor→Endpoint relationship — interceptors use `TRANSFORMS`. Endpoint-level `PROTECTS`/`TRANSFORMS` reuse the lifecycle-node FQN scheme (`${cls.fqn}~kind:name`); FQN deduplication prevents duplicate nodes when class-level (AI) and endpoint-level (parser) entries overlap.

#### Scenario: Import dependency maps to DEPENDS_ON edge

- GIVEN an IR dependency from Module A to Module B with type `import`
- WHEN the Knowledge Graph builder processes it
- THEN a DEPENDS_ON edge is created from A's node to B's node

#### Scenario: Class implements interface maps to IMPLEMENTS edge

- GIVEN an IR relationship of kind `implements` from a Class to an Interface
- WHEN the Knowledge Graph builder processes it
- THEN an IMPLEMENTS edge is created from the Class node to the Interface node

#### Scenario: Guard assigned to endpoint creates PROTECTS edge (endpoint-level)

- GIVEN an IrEndpoint with lifecycle entry `{ kind: 'guard', classRef: 'JwtGuard' }`
- WHEN the Semantic Model builder processes it
- THEN a PROTECTS edge is created from the Guard's lifecycle node (FQN `${cls.fqn}~guard:JwtGuard`) to the Endpoint node

#### Scenario: Class-level PROTECTS edge continues to work

- GIVEN an ai-enrichment lifecycle entry `guard:JwtGuard` on a controller class
- WHEN the Semantic Model builder processes it
- THEN a PROTECTS edge is created from the Guard's lifecycle node to the Controller node

### Requirement: INVOKES Edge — Approximate Call Chain

The system SHALL add an `INVOKES` edge type representing an approximate method-call chain between injectable classes. The edge SHALL flow from caller to callee: `Controller → Service → Repository`. The edge SHALL carry `properties.approximate = true` to signal that the call order derives from constructor DI + module import reachability, NOT method-body call analysis.

#### Scenario: Controller-to-service INVOKES edge created from DI

- GIVEN a controller class with constructor parameter `private userService: UserService`
- WHEN the Semantic Model builder processes the class
- THEN an `INVOKES` edge is created from the Controller node to the Service node
- AND `properties.approximate` is `true`

#### Scenario: Service-to-repository INVOKES edge from DI

- GIVEN a service class with constructor parameter `private userRepo: UserRepository`
- WHEN the Semantic Model builder processes the class
- THEN an `INVOKES` edge is created from the Service node to the Repository node
- AND `properties.approximate` is `true`

### Requirement: INJECTS Edge — Constructor Dependency Injection

The system SHALL add an `INJECTS` edge type representing constructor-based dependency injection. The edge SHALL flow from the dependent class to the injected dependency. The edge SHALL be derived from `IrClass.constructorParams` (already populated by ai-enrichment). No method-body analysis SHALL be used.

#### Scenario: Single injection creates INJECTS edge

- GIVEN a class `UsersController` with constructor `constructor(private svc: UsersService)`
- WHEN the Semantic Model builder processes it
- THEN an `INJECTS` edge is created from `UsersController` to `UsersService`

#### Scenario: Multiple injections produce one edge each

- GIVEN a class with `constructor(private a: ServiceA, private b: ServiceB)`
- WHEN the Semantic Model builder processes it
- THEN two `INJECTS` edges are created: one to ServiceA, one to ServiceB

### Requirement: Endpoint-to-DTO Typing Edges

The system SHALL create `DEPENDS_ON` edges from `ENDPOINT` nodes to `DTO` nodes when parameter type annotations reference a DTO class. The edge SHALL carry `properties.reason = 'parameter-type'` and `properties.paramName` (the parameter name). Mapping SHALL use `IrEndpoint.typedParams` (projected from `IrMethod.params` in `buildEndpoints()`).

#### Scenario: @Body() DTO parameter creates DEPENDS_ON edge

- GIVEN a controller method `create(@Body() dto: CreateUserDto)` processed into an IrEndpoint with `typedParams[0] = { name: 'dto', typeAnnotation: 'CreateUserDto', decorator: '@Body' }`
- WHEN the Semantic Model builder processes the endpoint
- THEN a `DEPENDS_ON` edge is created from the ENDPOINT node to the DTO node named `CreateUserDto`
- AND `properties.reason` is `'parameter-type'`

#### Scenario: Primitive-typed parameter produces no DTO edge

- GIVEN an endpoint with `@Query('page') page: number`
- WHEN the Semantic Model builder processes it
- THEN no DEPENDS_ON edge is created for the `page` parameter
- (Primitive types do not reference resolvable DTO classes)

### Requirement: Flow Availability on Graph Snapshots

The system SHALL track whether flow data is available per snapshot. Snapshots built before the flow-data version SHALL return `flowAvailable: false`. Snapshots built after SHALL return `flowAvailable: true`. The graph version SHALL be incremented to signal that re-analysis is required for flow support.

#### Scenario: Old snapshot returns flowAvailable false

- GIVEN a snapshot built at version 1 (pre-flow-data)
- WHEN `GET /graph/:repoId/endpoints/:fqn/flow` is called
- THEN the response includes `flowAvailable: false`
- AND returns HTTP 200 with an appropriate message, not a 404 or 500

#### Scenario: New snapshot returns flowAvailable true

- GIVEN a snapshot built at version 2 (post-flow-data, after re-analysis)
- WHEN `GET /graph/:repoId/endpoints/:fqn/flow` is called for a valid endpoint FQN
- THEN the response includes `flowAvailable: true`
- AND returns ordered lifecycle steps

### Requirement: Graph Node Value Object

Every graph node SHALL have: a UUID identifier, a type from the taxonomy, a human-readable label, a fully qualified name (FQN) stable across analysis versions, a JSONB properties bag for extensible metadata, a nullable `deprecated_at` timestamp for soft removal, and a repository identifier with version number.

The FQN combined with `repo_id` and `version` SHALL uniquely identify a node.

#### Scenario: Node FQN is stable across re-analyses

- GIVEN a repository re-analyzed producing the same class at the same path
- WHEN two separate analyses produce graph nodes for that class
- THEN both nodes share the same FQN
- AND differ only by version number

### Requirement: Graph Snapshot Value Object

Each graph build SHALL produce a snapshot recording: repository ID, analysis ID, commit SHA, node count, edge count, and status (`pending | building | built | failed`). Snapshots enable historical comparison and idempotency checks.

> **Note (implementation)**: Implemented as an AggregateRoot entity (`GraphSnapshotEntity`) with identity + lifecycle (`startBuilding`/`complete`/`fail`) to support DB persistence — a deliberate deviation from the "Value Object" title, verified functionally complete in sdd-verify (W1).

#### Scenario: Snapshot created after successful build

- GIVEN a completed graph build
- WHEN the build pipeline finishes
- THEN a snapshot exists with status `built`
- AND node_count and edge_count reflect the persisted graph

### Requirement: Semantic Model Value Object

The Semantic Model SHALL be a transient, in-memory normalization layer mapping IR concepts to language-independent architectural roles. It MUST NOT be persisted to the database.

#### Scenario: Semantic Model is discardable after graph build

- GIVEN a Semantic Model built from IR
- WHEN the Knowledge Graph builder consumes it and produces nodes and edges
- THEN the Semantic Model instance is no longer referenced and eligible for garbage collection

### Requirement: Domain Events

The bounded context SHALL publish `KnowledgeGraphBuilt` on initial graph construction and `KnowledgeGraphUpdated` on incremental updates. Both events SHALL carry the repository ID, snapshot ID, and analysis ID.

#### Scenario: Event published on first build

- GIVEN no prior graph exists for a repository
- WHEN the pipeline completes successfully
- THEN a `KnowledgeGraphBuilt` event is published with repository and snapshot IDs

### Requirement: Domain Errors

The domain SHALL define typed errors for: invalid node type, duplicate FQN within a version, missing source/target nodes in edges, and graph integrity violations. All errors SHALL carry a machine-readable code and human-readable message.

#### Scenario: Duplicate FQN rejected

- GIVEN a graph node with FQN already present in the same repository and version
- WHEN the persistence layer attempts to insert it
- THEN a `DuplicateNodeError` is raised with the conflicting FQN

### Requirement: Source File Tracking on Graph Nodes

Every graph node SHALL carry a nullable `sourceFile` property recording the source file path from which the node was derived (`IrNode.filePath`). The field SHALL be persisted as a `TEXT NULL` column on the `graph_nodes` table.

The migration SHALL be: `ALTER TABLE graph_nodes ADD COLUMN source_file TEXT NULL`. The column is additive, nullable, and has no default — existing rows retain `NULL`.

`SemanticModelBuilder` and `GraphBuilder` MUST propagate `sourceFile` from `IrNode.filePath` through to `GraphNodeEntity.sourceFile`. `GraphQueryService` MUST expose `sourceFile` in all node query responses.

#### Scenario: New analysis populates sourceFile

- GIVEN a fresh analysis of a repository containing `src/users/users.controller.ts`
- WHEN `SemanticModelBuilder` builds the Semantic Model from IR
- THEN the UserController model entry carries `sourceFile = 'src/users/users.controller.ts'`
- AND `GraphBuilder` persists a `GraphNodeEntity` with `source_file = 'src/users/users.controller.ts'`

#### Scenario: Old snapshot has null sourceFile

- GIVEN a database with graph nodes from a snapshot created before this change
- WHEN `GraphQueryService` queries those nodes
- THEN `sourceFile` is `null` in the response
- AND the API response is backward-compatible (no breaking change — field was never expected before)

#### Scenario: Multiple classes in one file share sourceFile

- GIVEN `src/utils/helpers.ts` contains three exported classes
- WHEN the analysis produces three IR classes from that file
- THEN all three resulting graph nodes carry `sourceFile = 'src/utils/helpers.ts'`
- AND the query "find all nodes from file X" returns all three

#### Scenario: sourceFile exposed via GraphQueryService

- GIVEN a graph query for nodes in a repository
- WHEN `GraphQueryService.getNodes()` is called
- THEN each returned node object includes `sourceFile: string | null`
- AND the frontend can display per-node source file attribution

### Requirement: sourceFile Migration Reversibility

The migration SHALL be reversible via `ALTER TABLE graph_nodes DROP COLUMN source_file`. Rolling back the column MUST not affect any existing graph node data — the column is purely additive. Older versions of the application (without the `sourceFile` field in the entity) SHALL continue to function with the column present — TypeORM ignores unmapped columns by default.

#### Scenario: Rollback drops column cleanly

- GIVEN the `source_file` column exists with data
- WHEN the rollback migration runs (`DROP COLUMN source_file`)
- THEN the column is removed
- AND all other graph node data is intact
- AND the application functions as before (no `sourceFile` in responses)

#### Scenario: Old application version tolerates column

- GIVEN the `source_file` column exists in the database
- WHEN an older version of the application (without `sourceFile` in `GraphNodeEntity`) connects
- THEN no errors occur on reads or writes
- AND TypeORM silently ignores the unmapped column

## References

- RFC-007 §6–7 (Semantic Model and Knowledge Graph), §10 (Storage)
- EPIC-006 §2.3 (Graph Model), §2.5 (Node Types)
- Intermediate Representation spec: `IrEndpoint.lifecycle` supplies endpoint-level PROTECTS/TRANSFORMS edges; `IrEndpoint.typedParams` drives DEPENDS_ON (parameter-type) edges; `IrClass.constructorParams` maps to INJECTS edges; the INVOKES chain derives from INJECTS + DEPENDS_ON reachability
- TypeScript Parser spec: `decorator-role-registry.ts` additions enable the IR projections that feed these edges
- Visualization Views spec: REQUEST_FLOW view consumes INVOKES/INJECTS edges for the approximate service tail; the frontend `EdgeType` enum mirrors the new edge types
