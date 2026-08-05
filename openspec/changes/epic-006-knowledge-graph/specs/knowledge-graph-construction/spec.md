# knowledge-graph-construction Specification

## Purpose

Define the deterministic two-stage pipeline that transforms an Intermediate Representation into a typed Knowledge Graph: Stage 1 normalizes IR concepts into a Semantic Model, and Stage 2 builds typed nodes and directed edges with integrity validation. Per RFC-007 §6–7.

## Requirements

### Requirement: Semantic Model Builder — Role Mapping

The Semantic Model builder SHALL map every IR class to a Semantic Model entry using explicit rules. Recognized IR roles (`controller`, `service`, `repository`) SHALL map directly to the corresponding graph node types. Unrecognized classes SHALL be classified via name/path heuristics or fall back to `Unknown`.

| IR Role / Heuristic                  | Semantic Model Type |
| ------------------------------------ | ------------------- |
| `controller`                         | Controller          |
| `service`                            | Service             |
| `repository`                         | Repository          |
| Name ends with `Dto` or `DTO`        | DTO                 |
| Name ends with `Entity`              | Entity              |
| File under `entities/` or `domain/`  | Entity              |
| Name matches `I[A-Z]*` pattern       | Interface           |
| Unresolved external import specifier | ExternalDependency  |
| None of the above                    | Unknown             |

#### Scenario: IrClass with controller role maps to Controller

- GIVEN an IrClass with `role = 'controller'`
- WHEN SemanticModelBuilder processes it
- THEN the output entry has type `Controller`

#### Scenario: IrClass named CreateUserDto without role maps to DTO

- GIVEN an IrClass with `role = null` and `name = 'CreateUserDto'`
- WHEN SemanticModelBuilder processes it
- THEN the output entry has type `DTO`

#### Scenario: Unrecognized class falls back to Unknown

- GIVEN an IrClass with `role = null` and `name = 'SomeHelper'`
- WHEN SemanticModelBuilder processes it and no heuristic matches
- THEN the output entry has type `Unknown`

### Requirement: Semantic Model Builder — IR Traversal

The builder SHALL traverse the full IR tree: Project → Package → Module → Class/Interface/Function → Method/Endpoint. Each IR node SHALL produce exactly one Semantic Model entry. IR Dependencies SHALL be passed through as model-level dependency references.

#### Scenario: Full IR tree produces entries for every level

- GIVEN an IR with 1 Project, 2 Packages, 3 Modules, and 5 Classes
- WHEN SemanticModelBuilder processes it
- THEN the Semantic Model contains at least 11 entries (one per IR node)

### Requirement: Knowledge Graph Builder — Node Creation

The Knowledge Graph builder SHALL create one typed GraphNode per Semantic Model entry. Node FQNs SHALL be derived from the IR FQN hierarchy and remain stable across versions. Node properties (JSONB) SHALL capture source-level metadata: file path, language, exported status, and abstract flag.

#### Scenario: Every Semantic Model entry produces a GraphNode

- GIVEN a Semantic Model with N entries
- WHEN KnowledgeGraphBuilder processes it
- THEN exactly N GraphNodes are produced
- AND each node has a non-empty `type`, `label`, and `fqn`

### Requirement: Knowledge Graph Builder — Edge Derivation

The graph builder SHALL derive edges from the IR as follows:

| IR Source                                    | Edge Type  | Condition                               |
| -------------------------------------------- | ---------- | --------------------------------------- |
| IrDependency (type: import, internal target) | DEPENDS_ON | Target FQN resolves to a graph node     |
| IrDependency (type: import, external target) | IMPORTS    | Target is an ExternalDependency node    |
| IrRelationship (kind: extends)               | EXTENDS    | Source and target nodes exist           |
| IrRelationship (kind: implements)            | IMPLEMENTS | Source and target nodes exist           |
| IrEndpoint on IrClass with Controller role   | EXPOSES    | Controller node and Endpoint node exist |
| Structural parent-child (Module→Class)       | BELONGS_TO | Both parent and child nodes exist       |

#### Scenario: Module-level import produces DEPENDS_ON

- GIVEN an IR dependency `ModuleA → ModuleB` of type `import`
- WHEN KnowledgeGraphBuilder processes it
- THEN a DEPENDS_ON edge exists from ModuleA node to ModuleB node

#### Scenario: Controller endpoint produces EXPOSES edge

- GIVEN a Controller class with two IrEndpoints
- WHEN KnowledgeGraphBuilder processes it
- THEN two EXPOSES edges exist from the Controller node to each Endpoint node

#### Scenario: Unresolved external import produces IMPORTS edge

- GIVEN an IR dependency targeting `rxjs` (not resolved in the node set)
- WHEN KnowledgeGraphBuilder processes it
- THEN an ExternalDependency node is created for `rxjs`
- AND an IMPORTS edge exists from the importing module to the ExternalDependency node

### Requirement: Graph Integrity Validation

The builder SHALL validate that every edge references existing source and target nodes. Dangling edges SHALL be dropped with a warning, not block construction. Orphan nodes (no edges) SHALL be permitted.

#### Scenario: Dangling edge is dropped

- GIVEN a Semantic Model with an edge whose target FQN does not resolve to any node
- WHEN KnowledgeGraphBuilder validates the graph
- THEN the dangling edge is excluded from output
- AND a validation warning is recorded

#### Scenario: Orphan node is permitted

- GIVEN a node with no incoming or outgoing edges
- WHEN KnowledgeGraphBuilder validates the graph
- THEN the node is included in the output with no warnings

### Requirement: Deterministic Output

The same IR input SHALL always produce the same set of nodes and edges. No randomness, AI inference, or external state SHALL influence the construction pipeline.

#### Scenario: Repeated construction is identical

- GIVEN the same IR snapshot processed twice
- WHEN KnowledgeGraphBuilder runs both times
- THEN the resulting node set and edge set are byte-identical

## References

- RFC-007 §6 (Semantic Model Builder), §7 (Knowledge Graph Builder), §7.4 (Consistency Rules)
- EPIC-006 §2.1 (Graph Construction)
