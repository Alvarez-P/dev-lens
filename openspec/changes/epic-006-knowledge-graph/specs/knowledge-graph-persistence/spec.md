# knowledge-graph-persistence Specification

## Purpose

Define the persistence layer for the Knowledge Graph using PostgreSQL relational tables with JSONB properties, TypeORM entities, versioned snapshots, soft-deprecation, and database migrations. Per RFC-007 §10.1.

## Requirements

### Requirement: GraphNode Entity

The system SHALL persist graph nodes in a `graph_nodes` table via a TypeORM entity with columns: `id` (UUID PK, auto-generated), `type` (varchar 64, indexed), `label` (varchar 255), `fqn` (varchar 512), `properties` (JSONB, GIN-indexed), `repo_id` (UUID, indexed), `version` (integer), `deprecated_at` (timestamptz, nullable), `source_analysis_id` (UUID), plus standard `created_at` and `updated_at` timestamps.

A composite unique constraint SHALL exist on `(fqn, repo_id, version)`.

#### Scenario: Insert node with unique FQN succeeds

- GIVEN no node exists with `fqn = 'my-project:my-pkg:auth:AuthService'` for `repo_id = X` and `version = 1`
- WHEN a GraphNode is persisted with those values
- THEN the row is inserted successfully

#### Scenario: Duplicate FQN within same version is rejected

- GIVEN a node already exists with `fqn = 'my-project:my-pkg:auth:AuthService'`, `repo_id = X`, `version = 1`
- WHEN another GraphNode with the same FQN, repo, and version is inserted
- THEN the insert fails with a unique constraint violation

### Requirement: GraphEdge Entity

The system SHALL persist graph edges in a `graph_edges` table with: `id` (UUID PK), `type` (varchar 64, indexed), `source_node_id` (UUID FK → graph_nodes, indexed), `target_node_id` (UUID FK → graph_nodes, indexed), `properties` (JSONB), `version` (integer), and `created_at`. Both foreign keys SHALL be non-nullable.

#### Scenario: Edge references valid nodes

- GIVEN two persisted graph nodes with IDs A and B
- WHEN a DEPENDS_ON edge is created from A to B
- THEN the edge is persisted successfully

#### Scenario: Edge with non-existent target fails

- GIVEN a graph edge referencing a target node ID that does not exist in `graph_nodes`
- WHEN the edge is inserted
- THEN the database rejects it with a foreign key violation

### Requirement: GraphSnapshot Entity

The system SHALL persist build metadata in a `graph_snapshots` table with: `id` (UUID PK), `repository_id` (UUID), `analysis_id` (UUID, unique constraint for idempotency), `commit_sha` (varchar 64), `node_count` (integer), `edge_count` (integer), `status` (varchar 32, values: `pending`, `building`, `built`, `failed`), and `created_at`.

#### Scenario: Snapshot recorded after successful build

- GIVEN a completed graph build with 42 nodes and 58 edges
- WHEN the snapshot is persisted
- THEN a row exists with `status = 'built'`, `node_count = 42`, `edge_count = 58`

#### Scenario: Duplicate analysis_id rejected for idempotency

- GIVEN a snapshot already exists for `analysis_id = 'abc-123'`
- WHEN another snapshot with the same analysis_id is inserted
- THEN the insert fails with a unique constraint violation

### Requirement: Soft-Deprecation

Removed concepts SHALL be marked with `deprecated_at = NOW()` rather than hard-deleted. Active nodes SHALL have `deprecated_at IS NULL`. Query operations SHALL exclude deprecated nodes by default unless explicitly requested.

#### Scenario: Node deprecated instead of deleted

- GIVEN a node representing a class removed in a newer analysis
- WHEN the incremental update detects the class is absent from the new IR
- THEN the node's `deprecated_at` is set to the current timestamp
- AND the row is not deleted

#### Scenario: Active nodes exclude deprecated

- GIVEN 3 nodes, 1 with `deprecated_at` set and 2 with `deprecated_at IS NULL`
- WHEN querying for active nodes
- THEN only the 2 non-deprecated nodes are returned

### Requirement: Database Migration

A TypeORM migration file SHALL create the `graph_nodes`, `graph_edges`, and `graph_snapshots` tables with all columns, indexes, and constraints defined above. The migration SHALL be placed in `shared/infrastructure/persistence/migrations/` and follow the existing migration naming convention.

#### Scenario: Migration produces correct schema

- GIVEN the migration is run against a fresh PostgreSQL database
- WHEN `\d graph_nodes`, `\d graph_edges`, `\d graph_snapshots` are executed
- THEN all three tables exist with the declared columns, indexes, FKs, and unique constraints

### Requirement: Transactional Persistence

All nodes and edges from a single graph build SHALL be persisted within a single database transaction. If any insert fails, the entire build SHALL be rolled back and the snapshot status set to `failed`.

#### Scenario: Partial failure rolls back entire build

- GIVEN a graph build with 50 nodes and one edge referencing a non-existent target
- WHEN the transaction commits
- THEN zero nodes, zero edges, and zero snapshots are persisted
- AND the build is retried or marked failed

## References

- RFC-007 §10.1 (Storage), §10.2 (Serialization), §8.2 (Delta Application)
- EPIC-006 §2.4 (Persistence), Exploration §2.2 (Recommended Schema)
