# Delta for knowledge-graph-model

> **Change**: EPIC-008 | **Type**: Modified | **Cross-reference**: ai-context-assembly, ai-lifecycle-analysis

## ADDED Requirements

### Requirement: Source File Persistence on Graph Nodes

Every graph node SHALL carry an optional `sourceFile` property: a relative path from the repository root to the source file from which the node was extracted. The path SHALL be normalized (forward slashes, no leading `./`). This property is populated during graph construction from the Intermediate Representation (IR) and is nullable — nodes synthesized without a source (e.g., PROJECT, EXTERNAL_DEPENDENCY) SHALL have `sourceFile: null`.

#### Scenario: Class node stores its source file path

- GIVEN a TypeScript class defined in `src/modules/orders/OrderService.ts`
- WHEN `SemanticModelBuilder` processes the IR for that class
- THEN the resulting graph node has `sourceFile: "src/modules/orders/OrderService.ts"`

#### Scenario: Project node has null sourceFile

- GIVEN a PROJECT node synthesized from repository metadata
- WHEN the node is created
- THEN `sourceFile` is `null`

#### Scenario: File path is normalized

- GIVEN an IR module with path `./src\\utils\\helpers.ts`
- WHEN the `sourceFile` property is set
- THEN the stored value is `"src/utils/helpers.ts"` (forward slashes, no leading `./`)

## MODIFIED Requirements

### Requirement: Graph Node Value Object

Every graph node SHALL have: a UUID identifier, a type from the taxonomy, a human-readable label, a fully qualified name (FQN) stable across analysis versions, a JSONB properties bag for extensible metadata, a nullable `sourceFile` path (relative from repo root to the source file), a nullable `deprecated_at` timestamp for soft removal, and a repository identifier with version number.

The FQN combined with `repo_id` and `version` SHALL uniquely identify a node.

(Previously: nodes had no `sourceFile` property; FQN → source-file mapping required querying `analysis.ir` via `AnalysisRepository`.)

#### Scenario: Node FQN is stable across re-analyses

- GIVEN a repository re-analyzed producing the same class at the same path
- WHEN two separate analyses produce graph nodes for that class
- THEN both nodes share the same FQN
- AND differ only by version number
- AND both carry the same `sourceFile` value

#### Scenario: Node with sourceFile is persisted and queryable

- GIVEN a graph node with `sourceFile: "src/modules/orders/OrderService.ts"`
- WHEN the node is persisted to the database
- THEN the `sourceFile` value is stored and retrievable via GraphQueryService
- AND downstream consumers (e.g., ai-context-assembly) can resolve the file path directly from the graph node without querying `analysis.ir`

## REMOVED Requirements

None.
