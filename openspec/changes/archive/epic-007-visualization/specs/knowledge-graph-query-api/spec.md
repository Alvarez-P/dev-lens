# Delta for knowledge-graph-query-api

> **Modified capability** | EPIC-007 C1 | Modifies `openspec/specs/knowledge-graph-query-api/spec.md`

## ADDED Requirements

### Requirement: Graph Export Endpoint

The API SHALL expose `GET /api/v1/graph/:repoId/export?version=` returning all nodes and edges in a single JSON response without pagination. The response SHALL include a `meta` object with `nodeCount`, `edgeCount`, and `version`.

#### Scenario: Export full graph for visualization

- GIVEN a repository graph with 500 nodes and 1200 edges at version 3
- WHEN calling `GET /api/v1/graph/:repoId/export`
- THEN the response contains all 500 nodes and 1200 edges
- AND `meta.nodeCount` is 500, `meta.edgeCount` is 1200, `meta.version` is 3

#### Scenario: Export specific version

- GIVEN a repository with graph versions 2 (300 nodes) and 3 (500 nodes)
- WHEN calling `GET /api/v1/graph/:repoId/export?version=2`
- THEN only nodes and edges from version 2 are returned
- AND `meta.version` is 2

#### Scenario: Export on empty graph returns null

- GIVEN a repository with no graph data
- WHEN calling the export endpoint
- THEN `null` is returned (not an error)

### Requirement: JWT Guard on Graph Endpoints

All `GraphController` endpoints SHALL be protected by a JWT guard enforcing repo-membership. Unauthenticated requests SHALL return 401; unauthorized (non-member) SHALL return 403.

#### Scenario: Authenticated member accesses graph

- GIVEN a user authenticated via JWT who is a member of repository R
- WHEN accessing any `/api/v1/graph/R/*` endpoint
- THEN the request succeeds

#### Scenario: Unauthenticated request returns 401

- GIVEN no JWT token in the request
- WHEN accessing `/api/v1/graph/:repoId/nodes`
- THEN a 401 response is returned

#### Scenario: Non-member returns 403

- GIVEN a user authenticated but not a member of repository R
- WHEN accessing any `/api/v1/graph/R/*` endpoint
- THEN a 403 response is returned

## MODIFIED Requirements

### Requirement: Query Node Neighborhood

The API SHALL support querying a node's neighborhood — all incoming edges, all outgoing edges, or both — in a single call. The `direction` query param SHALL accept `in`, `out`, or `both` (default). The result SHALL include the neighbor nodes referenced by those edges.
(Previously: No `direction` query param existed; only `both` was implicitly returned.)

#### Scenario: Full neighborhood returned (unchanged)

- GIVEN a Controller node C with 3 incoming DEPENDS_ON edges and 2 outgoing EXPOSES edges
- WHEN querying the neighborhood of C
- THEN 5 edges are returned
- AND the 3 source nodes of incoming edges and 2 target nodes of outgoing edges are included in the response

#### Scenario: Outgoing-only neighborhood (new)

- GIVEN a node with 3 incoming and 4 outgoing edges
- WHEN querying the neighborhood with `direction=out`
- THEN only the 4 outgoing edges and their target nodes are returned

#### Scenario: Incoming-only neighborhood (new)

- GIVEN a node with 3 incoming and 4 outgoing edges
- WHEN querying the neighborhood with `direction=in`
- THEN only the 3 incoming edges and their source nodes are returned

### Requirement: Filter by Node Type

The query API SHALL support filtering results by node type. Multiple types MUST be accepted via repeated `type[]` query parameters. The existing single `type` param SHALL remain supported for backward compatibility.
(Previously: DTO accepted only a single `string` type; the static core already supported `NodeType[]`.)

#### Scenario: Filter nodes by single type (unchanged, backward-compatible)

- GIVEN a graph with 5 Controllers, 12 Services, and 3 Repositories
- WHEN querying nodes with `type=Controller`
- THEN exactly 5 nodes are returned

#### Scenario: Filter nodes by multiple types (updated)

- GIVEN a graph with 5 Controllers, 12 Services, and 3 Repositories
- WHEN querying nodes with `type[]=Controller&type[]=Service`
- THEN 17 nodes are returned

#### Scenario: Invalid node type returns 400 (unchanged)

- GIVEN a query with `type=NonExistentType`
- WHEN the query executes
- THEN a 400 response is returned

### Requirement: Error Responses (modified for JWT)

Invalid query parameters (unknown type, negative limit) SHALL return a 400 Bad Request with a descriptive error message. All `GraphController` endpoints SHALL enforce JWT authentication; unauthenticated requests SHALL return 401, and unauthorized (non-member) requests SHALL return 403.
(Previously: 401/403 auth enforcement existed as a note / follow-up flag. No JWT guard was present on `GraphController`.)

#### Scenario: Invalid node type returns 400 (unchanged)

- GIVEN a query with `type=NonExistentType`
- WHEN the query executes
- THEN a 400 response is returned

#### Scenario: Unauthenticated request (new)

- GIVEN no JWT token
- WHEN accessing any graph endpoint
- THEN a 401 response is returned

## References

- Original spec: `openspec/specs/knowledge-graph-query-api/spec.md` (archived from EPIC-006)
- Modified W9 (multi-type), W8 (direction filtering)
- RFC-007 §9, §14 (Security)
- EPIC-007 C1 (Backend extensions slice)
