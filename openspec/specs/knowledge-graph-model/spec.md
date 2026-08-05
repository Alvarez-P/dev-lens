# knowledge-graph-model Specification

> **Archived from**: `epic-006-knowledge-graph` (2026-08-04)

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

| Edge       | Source     | Target                 | Trigger                          |
| ---------- | ---------- | ---------------------- | -------------------------------- |
| BELONGS_TO | Any node   | Module/Package/Project | Structural containment           |
| DEPENDS_ON | Any node   | Any node               | Import statement (IR dependency) |
| IMPLEMENTS | Class      | Interface              | `implements` clause              |
| EXTENDS    | Class      | Class                  | `extends` clause                 |
| EXPOSES    | Controller | Endpoint               | Method with HTTP decorator       |
| IMPORTS    | Module     | ExternalDependency     | Unresolved external import       |

#### Scenario: Import dependency maps to DEPENDS_ON edge

- GIVEN an IR dependency from Module A to Module B with type `import`
- WHEN the Knowledge Graph builder processes it
- THEN a DEPENDS_ON edge is created from A's node to B's node

#### Scenario: Class implements interface maps to IMPLEMENTS edge

- GIVEN an IR relationship of kind `implements` from a Class to an Interface
- WHEN the Knowledge Graph builder processes it
- THEN an IMPLEMENTS edge is created from the Class node to the Interface node

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

## References

- RFC-007 §6–7 (Semantic Model and Knowledge Graph), §10 (Storage)
- EPIC-006 §2.3 (Graph Model), §2.5 (Node Types)
