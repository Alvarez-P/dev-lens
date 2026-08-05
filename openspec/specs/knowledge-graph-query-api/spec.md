# knowledge-graph-query-api Specification

> **Archived from**: `epic-006-knowledge-graph` (2026-08-04)

## Purpose

Define the read-only query API for the Knowledge Graph, exposed via a dedicated `GraphQueryService` and controller. Supports node lookup, edge traversal, neighborhood extraction, and filtering by type. Per RFC-007 §9.

## Requirements

### Requirement: Query by Repository and Version

The query API SHALL retrieve the latest graph version for a given repository when no version is specified. When a specific version is requested, that version's graph SHALL be returned. Deprecated nodes SHALL be excluded by default.

#### Scenario: Latest graph returned without version

- GIVEN a repository with graph snapshots at versions 1, 2, and 3
- WHEN a query requests the graph for that repository without specifying a version
- THEN the nodes and edges from version 3 are returned

#### Scenario: Specific version returned when requested

- GIVEN a repository with graph snapshots at versions 1, 2, and 3
- WHEN a query requests version 2 explicitly
- THEN only nodes and edges from version 2 are returned

### Requirement: Query Node by FQN

The API SHALL support looking up a single graph node by its fully qualified name within a repository and version context. If no matching node exists, the result SHALL be null (not an error).

#### Scenario: Node found by FQN

- GIVEN a graph containing a node with `fqn = 'my-project:my-pkg:auth:AuthService'` and `version = 2`
- WHEN querying by that FQN for version 2
- THEN the node is returned with its type, label, properties, and edge count

#### Scenario: Node not found returns null

- GIVEN a graph containing no node with `fqn = 'nonexistent:module:Class'`
- WHEN querying by that FQN
- THEN null is returned

### Requirement: Query Edges by Source and Target

The API SHALL support listing edges filtered by source node ID, target node ID, edge type, or any combination thereof. Results SHALL be scoped to the requested repository version.

#### Scenario: Filter edges by source node

- GIVEN a node A with 5 outgoing edges and 3 incoming edges
- WHEN querying edges with `source_node_id = A`
- THEN exactly the 5 outgoing edges are returned

#### Scenario: Filter edges by type

- GIVEN a graph with 10 DEPENDS_ON edges and 4 EXPOSES edges
- WHEN querying edges with `type = 'EXPOSES'`
- THEN exactly 4 edges are returned

### Requirement: Query Node Neighborhood

The API SHALL support querying a node's neighborhood — all incoming edges, all outgoing edges, or both — in a single call. The result SHALL include the neighbor nodes referenced by those edges.

> **Note (implementation)**: `GraphQueryService.getNeighborhood` supports direction filtering; the REST endpoint currently returns both directions (verified W8).

#### Scenario: Full neighborhood returned

- GIVEN a Controller node C with 3 incoming DEPENDS_ON edges and 2 outgoing EXPOSES edges
- WHEN querying the neighborhood of C
- THEN 5 edges are returned
- AND the 3 source nodes of incoming edges and 2 target nodes of outgoing edges are included in the response

#### Scenario: Outgoing-only neighborhood

- GIVEN a node with 3 incoming and 4 outgoing edges
- WHEN querying the neighborhood with direction `outgoing`
- THEN only the 4 outgoing edges and their target nodes are returned

### Requirement: Filter by Node Type

The query API SHALL support filtering results by node type. Multiple types MAY be specified in a single query.

> **Note (implementation)**: The static core supports `NodeType[]`; the REST DTO currently accepts a single `string` type (verified W9).

#### Scenario: Filter nodes by single type

- GIVEN a graph with 5 Controllers, 12 Services, and 3 Repositories
- WHEN querying nodes with `type = 'Controller'`
- THEN exactly 5 nodes are returned

#### Scenario: Filter nodes by multiple types

- GIVEN a graph with 5 Controllers, 12 Services, and 3 Repositories
- WHEN querying nodes with `type IN ('Controller', 'Service')`
- THEN 17 nodes are returned

### Requirement: JSON-Serializable Results

All query results SHALL be plain objects serializable via `JSON.stringify`. No circular references, TypeORM internals, or database-specific types SHALL leak into API responses.

#### Scenario: Response is valid JSON

- GIVEN any successful query
- WHEN the response is serialized with `JSON.stringify`
- THEN the operation succeeds without error
- AND the output contains only plain objects, arrays, strings, numbers, booleans, and nulls

### Requirement: Error Responses

Invalid query parameters (unknown type, negative limit) SHALL return a 400 Bad Request with a descriptive error message. Repository-scoped queries SHALL enforce that the requesting user has access to the repository.

> **Note (implementation)**: 400/404 responses are implemented via class-validator DTOs. Repository access enforcement requires auth + repo-membership, flagged as a follow-up (no JWT guard on `GraphController`, verified S5/W5).

#### Scenario: Invalid node type returns 400

- GIVEN a query with `type = 'NonExistentType'`
- WHEN the query executes
- THEN a 400 response is returned
- AND the error message indicates the type is not recognized

### Requirement: Pagination

Queries that may return large result sets (neighborhood, edge listing) SHALL support pagination via `limit` and `offset` parameters with a default limit of 50 and a maximum limit of 200.

#### Scenario: Paginated edge results

- GIVEN a node with 100 outgoing edges
- WHEN querying with `limit = 20` and `offset = 0`
- THEN 20 edges are returned
- AND the response includes a `total` count of 100

## References

- RFC-007 §9 (Query API), §9.2 (API Principles), §14 (Security)
- EPIC-006 §2.5 (Query API), Exploration §5 (Key Design Decisions)
