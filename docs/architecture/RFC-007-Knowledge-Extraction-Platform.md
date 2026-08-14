# RFC-007 — Knowledge Extraction Platform

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Knowledge Extraction Platform, the bounded context responsible for transforming the Intermediate Representation (IR) produced by RFC-006 into a fully connected, queryable Knowledge Graph.

The platform bridges deterministic static analysis and every downstream capability in DevLens: visualization, AI orchestration, documentation generation, search, and metrics.

No AI is involved in this stage. The entire pipeline — from IR ingestion to graph construction — is deterministic, reproducible, and auditable.

The Knowledge Graph is the single source of truth for DevLens. Every capability that explains, visualizes, searches, or measures software must consume the graph rather than raw source code.

---

# 2. Motivation

The IR defined in RFC-006 captures software concepts (modules, classes, endpoints, dependencies) as structured metadata. However, metadata alone does not constitute understanding.

Understanding emerges from relationships:

- Which services depend on this module?
- Which endpoints publish which events?
- Which domain owns which aggregate?
- Which database tables are accessed by which controllers?

The Knowledge Extraction Platform transforms isolated metadata into a connected semantic network that answers these questions deterministically.

Without this platform, every downstream capability would need to independently reconstruct relationships from raw IR data — duplicating work, introducing inconsistency, and coupling consumers to IR internals.

---

# 3. Goals

The Knowledge Extraction Platform must:

- Consume the Intermediate Representation deterministically.
- Build a Semantic Model as an intermediate normalization layer.
- Construct the Knowledge Graph from the Semantic Model.
- Model software as typed nodes and directed relationships.
- Support incremental graph updates as repositories evolve.
- Expose a stable query API for downstream consumers.
- Remain language-agnostic and framework-agnostic.
- Validate graph consistency and referential integrity.
- Support historical snapshots for architecture timeline features.
- Never depend on AI inference.

---

# 4. Non-Goals

This RFC does **not** define:

- How the IR is produced (see RFC-006).
- How the Knowledge Graph is visualized (see RFC-008).
- How AI queries the graph (see RFC-009, RFC-010).
- How documentation is generated (see RFC-011).
- How search indexes are built (see RFC-012).
- How metrics are calculated (see RFC-013).

This bounded context builds the graph. It does not consume it.

---

# 5. Pipeline Architecture

The Knowledge Extraction Platform processes each analysis snapshot through three sequential stages:

```text
Intermediate Representation (IR)
        │
        ▼
Semantic Model Builder
        │
        ▼
Semantic Model
        │
        ▼
Knowledge Graph Builder
        │
        ▼
Knowledge Graph
        │
        ├────────────► Visualization Engine
        ├────────────► AI Orchestrator
        ├────────────► Documentation Engine
        ├────────────► Search Engine
        └────────────► Metrics Engine
```

Each stage has a single responsibility. The pipeline is triggered by the `StaticAnalysisCompleted` domain event published by RFC-006.

---

# 6. Stage 1 — Semantic Model Builder

## 6.1 Purpose

The IR represents software concepts as they exist in source code — language-specific, AST-derived, and structurally organized.

The Semantic Model Builder normalizes these concepts into a language-independent domain model that represents software architecture rather than syntax.

## 6.2 Normalization Rules

The builder applies the following transformations:

| IR Concept                                            | Semantic Model Concept |
| ----------------------------------------------------- | ---------------------- |
| TypeScript `class` annotated with `@Controller()`     | `Controller`           |
| TypeScript `class` annotated with `@Injectable()`     | `Service`              |
| Python `class` with FastAPI route decorators          | `Controller`           |
| Java `class` annotated with `@RestController`         | `Controller`           |
| Any exported function matching HTTP method signatures | `Endpoint`             |
| DTO/Entity classes with decorators                    | `Entity` or `DTO`      |
| Interface definitions                                 | `Interface`            |
| Module/package declarations                           | `Module`               |
| Import statements                                     | `Dependency`           |
| Event emitter calls (Kafka, RabbitMQ, EventEmitter)   | `EventProducer`        |
| Event handler/listener registrations                  | `EventConsumer`        |

## 6.3 Semantic Model Structure

The Semantic Model includes:

- **Projects**: top-level repository representation.
- **Packages**: package.json modules, Maven modules, Cargo crates.
- **Modules**: logical groupings of related code.
- **Domains**: inferred bounded contexts based on naming conventions and folder structure.
- **Controllers**: HTTP/gRPC/WebSocket entry points.
- **Services**: business logic classes.
- **Entities**: domain objects with identity.
- **Value Objects**: immutable domain concepts.
- **DTOs**: data transfer objects.
- **Repositories**: data access abstractions.
- **Endpoints**: individual API operations.
- **Events**: domain events, integration events.
- **Commands**: command objects (CQRS).
- **Queries**: query objects (CQRS).
- **Interfaces**: contracts, protocols, traits.
- **Dependencies**: directed relationships between components.
- **External Services**: third-party integrations.

## 6.4 Deterministic Constraints

- Every concept type is assigned by explicit rules, never inferred by AI.
- Framework detection is based on dependency analysis (package.json, pom.xml, requirements.txt).
- Annotation/decorator mapping is explicit and configurable per framework.
- Unrecognized patterns are classified as `Unknown` rather than guessed.

---

# 7. Stage 2 — Knowledge Graph Builder

## 7.1 Purpose

The Knowledge Graph Builder transforms the Semantic Model into a connected graph of typed nodes and directed relationships.

This is where isolated concepts become a navigable system model.

## 7.2 Node Types

Every node in the Knowledge Graph has:

- A unique identifier.
- A type from the taxonomy.
- A label (human-readable name).
- Properties (language, file path, metadata).
- A reference to the source IR artifact.

### Taxonomy

| Category          | Node Types                                                |
| ----------------- | --------------------------------------------------------- |
| **Structure**     | `Project`, `Package`, `Module`, `Directory`               |
| **Domain**        | `BoundedContext`, `Aggregate`, `Entity`, `ValueObject`    |
| **Application**   | `Service`, `Controller`, `Endpoint`, `Command`, `Query`   |
| **Data**          | `Repository`, `DTO`, `Entity`, `DatabaseTable`            |
| **Communication** | `Event`, `EventProducer`, `EventConsumer`, `MessageQueue` |
| **External**      | `ExternalService`, `ExternalAPI`, `SDK`                   |
| **Contracts**     | `Interface`, `AbstractClass`, `TypeAlias`                 |
| **Organization**  | `Organization`, `Workspace`, `Repository`                 |

## 7.3 Relationship Types

Relationships are directed edges with semantic meaning:

| Relationship    | Source → Target                 | Meaning                 |
| --------------- | ------------------------------- | ----------------------- |
| `BELONGS_TO`    | Any concept → `Module`          | Code organization       |
| `OWNS`          | `BoundedContext` → `Aggregate`  | Domain ownership        |
| `DEPENDS_ON`    | Any concept → Any concept       | Import/usage dependency |
| `IMPLEMENTS`    | `Service` → `Interface`         | Contract fulfillment    |
| `EXTENDS`       | `Entity` → `Entity`             | Inheritance             |
| `EXPOSES`       | `Controller` → `Endpoint`       | API surface             |
| `PUBLISHES`     | `Service` → `Event`             | Event production        |
| `SUBSCRIBES_TO` | `Service` → `Event`             | Event consumption       |
| `CALLS`         | Any concept → `ExternalService` | External integration    |
| `PERSISTS_TO`   | `Repository` → `DatabaseTable`  | Data access             |
| `RETURNS`       | `Endpoint` → `DTO`              | API response            |
| `ACCEPTS`       | `Endpoint` → `DTO`              | API request             |
| `CONTAINS`      | `Aggregate` → `Entity`          | Aggregate composition   |

## 7.4 Graph Consistency Rules

The builder enforces:

- Every relationship must reference existing nodes.
- Bidirectional relationships are explicitly modeled in both directions.
- Circular dependencies are recorded as facts (not errors) but flagged for metrics.
- Orphan nodes are permitted (unused code is a valid observation).
- Graph integrity is validated after every incremental update.

---

# 8. Incremental Updates

The Knowledge Graph must evolve as repositories evolve.

## 8.1 Change Detection

When a new `StaticAnalysisCompleted` event arrives:

1. Compare the new IR with the previous IR for the same repository snapshot.
2. Identify: added concepts, removed concepts, modified concepts.
3. Compute the minimal graph delta.

## 8.2 Delta Application

- **Added concepts**: create new nodes and relationships.
- **Removed concepts**: mark nodes as deprecated (retain for historical queries) or remove if the snapshot is not retained.
- **Modified concepts**: update properties; re-evaluate relationships if structural changes occurred.

## 8.3 Historical Snapshots

Each graph state is versioned with the corresponding repository commit.

This enables:

- Architecture timeline visualization.
- "What changed?" queries between commits.
- Trend analysis for architectural metrics.

---

# 9. Query API

The Knowledge Graph exposes a stable API for downstream consumers.

## 9.1 Query Patterns

| Pattern                    | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| **Node lookup**            | Find a node by ID, type, or property.                        |
| **Relationship traversal** | Follow edges from a node.                                    |
| **Path finding**           | Find paths between two nodes.                                |
| **Subgraph extraction**    | Extract a neighborhood around a node.                        |
| **Dependency analysis**    | Find all direct and transitive dependencies.                 |
| **Impact analysis**        | Find all nodes that depend on a given node.                  |
| **Domain boundaries**      | Extract bounded context boundaries.                          |
| **Event flows**            | Trace event publication and consumption chains.              |
| **Full-text search**       | Search nodes by label and properties (delegates to RFC-012). |

## 9.2 API Principles

- The graph API is read-only for consumers. Mutations happen exclusively through the pipeline.
- Queries are paginated by default.
- Deep traversals have configurable depth limits.
- The API is versioned (v1, v2).
- Responses include graph metadata (node count, relationship count, snapshot version).

---

# 10. Storage

The Knowledge Graph is stored in a graph-compatible representation.

## 10.1 Primary Store

PostgreSQL with:

- Nodes table with JSONB properties.
- Relationships table with type, source, target, and metadata.
- Indexes on node type, node label (GIN for full-text), and relationship type.
- Materialized views for common traversal patterns.

## 10.2 Graph Serialization

The complete graph can be serialized to:

- JSON for export and backup.
- GraphML for external tooling.
- DOT for diagram generation.

## 10.3 Caching

Frequently accessed subgraphs are cached in Redis:

- Bounded context boundaries.
- Module dependency graphs.
- Top-level architecture overview.

Cache invalidation is triggered by incremental updates.

---

# 11. Domain Events

The Knowledge Extraction Platform publishes:

| Event                            | Trigger                              | Consumers               |
| -------------------------------- | ------------------------------------ | ----------------------- |
| `SemanticModelBuilt`             | Semantic Model construction complete | Internal only           |
| `KnowledgeGraphBuilt`            | Graph construction complete          | All downstream contexts |
| `KnowledgeGraphUpdated`          | Incremental update applied           | All downstream contexts |
| `KnowledgeGraphValidationFailed` | Integrity check failure              | Operations, alerting    |

---

# 12. Error Handling

## 12.1 IR Ingestion Failures

If the IR is malformed or incomplete:

- The pipeline rejects the snapshot.
- A `KnowledgeGraphBuildFailed` event is published with error details.
- The previous valid graph state is preserved.

## 12.2 Graph Inconsistencies

If relationship integrity is violated:

- The inconsistency is logged with full context.
- The graph is built with the inconsistency flagged (not blocked).
- A `KnowledgeGraphValidationWarning` event is published.

## 12.3 Retry Strategy

Failed builds are retried with exponential backoff via BullMQ. After 3 failures, the snapshot is marked as `failed` and requires manual intervention.

---

# 13. Performance Characteristics

Target metrics for the Knowledge Extraction Platform:

| Operation                                 | Target       |
| ----------------------------------------- | ------------ |
| Semantic Model construction (10K node IR) | < 5 seconds  |
| Knowledge Graph construction (10K nodes)  | < 10 seconds |
| Incremental update (1K delta)             | < 2 seconds  |
| Subgraph query (100 nodes)                | < 100ms      |
| Full dependency traversal                 | < 500ms      |
| Graph serialization (100K nodes)          | < 30 seconds |

Heavy graph construction runs asynchronously via BullMQ. The API remains responsive during builds by serving the previous valid graph state.

---

# 14. Security

- Graph queries are scoped to the requesting user's accessible repositories.
- The query API enforces organization and workspace boundaries.
- Graph export respects the same permission model as the query API.
- No source code is exposed through the graph API.

---

# 15. Future Considerations

- **Multi-repository graphs**: cross-repo dependency edges when multiple repositories are connected to the same organization.
- **Graph embeddings**: generate vector embeddings for nodes to enable semantic similarity search (RFC-012).
- **Graph versioning API**: expose historical snapshots through a dedicated timeline API.
- **Plugin architecture**: allow custom node types and relationship types for framework-specific concepts.
- **Graph federation**: support querying across multiple Knowledge Graph instances.

---

# 16. References

- RFC-001 — Architecture Principles
- RFC-002 — System Architecture
- RFC-004 — Event-Driven Architecture
- RFC-006 — Static Analysis & Intermediate Representation
- EPIC-006 — Knowledge Graph
- PRODUCT_CONTEXT.md — Section 14 (Knowledge Graph Philosophy)
