# Delta for knowledge-graph-model

> **Change**: ai-enrichment (2026-08-06) | **Capability**: Modified
>
> Adds nullable `sourceFile` column to graph nodes (Gap G1 from exploration §2.3). Existing spec: `openspec/specs/knowledge-graph-model/spec.md`

## ADDED Requirements

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
