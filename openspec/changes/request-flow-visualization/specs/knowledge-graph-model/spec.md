# Delta for knowledge-graph-model

## MODIFIED Requirements

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
| Guard              | IR lifecycle entry          | Request auth/authorization     |
| Pipe               | IR lifecycle entry          | Request transformation         |
| Interceptor        | IR lifecycle entry          | Pre/post handler interception  |
| Middleware         | IR lifecycle entry          | Framework middleware layer     |
| Unknown            | Fallback                    | Unrecognized concept           |

(Previously: 12 types; no lifecycle node types)

#### Scenario: Class with recognized role maps to typed node

- GIVEN an IR class with `role = 'controller'`
- WHEN the Semantic Model builder processes it
- THEN the resulting model entry has type `Controller`
- AND its FQN matches the IR class FQN

#### Scenario: Class without recognized role classified as Unknown

- GIVEN an IR class with `role = null` and name not matching any heuristic pattern
- WHEN the Semantic Model builder processes it
- THEN the resulting model entry has type `Unknown`

#### Scenario: Lifecycle class mapped to Guard node

- GIVEN an IR lifecycle entry of kind `guard` with a class reference
- WHEN the Semantic Model builder processes it
- THEN the resulting model entry has type `Guard`
- AND its properties include the FQN of the guard class

### Requirement: Graph Edge Types

The system SHALL model relationships using the following directed edge types:

| Edge       | Source      | Target                 | Trigger                          |
| ---------- | ----------- | ---------------------- | -------------------------------- |
| BELONGS_TO | Any node    | Module/Package/Project | Structural containment           |
| DEPENDS_ON | Any node    | Any node               | Import statement (IR dependency) |
| IMPLEMENTS | Class       | Interface              | `implements` clause              |
| EXTENDS    | Class       | Class                  | `extends` clause                 |
| EXPOSES    | Controller  | Endpoint               | Method with HTTP decorator       |
| IMPORTS    | Module      | ExternalDependency     | Unresolved external import       |
| PROTECTS   | Guard       | Endpoint               | `@UseGuards` on endpoint method  |
| TRANSFORMS | Pipe        | Endpoint               | `@UsePipes` on endpoint method   |
| INVOKES    | Interceptor | Endpoint               | `@UseInterceptors` on endpoint   |
| INJECTS    | Any Class   | Any Class              | Constructor injection            |

(Previously: 6 edge types; no flow-semantic edges)

#### Scenario: Import dependency maps to DEPENDS_ON edge

- GIVEN an IR dependency from Module A to Module B with type `import`
- WHEN the Knowledge Graph builder processes it
- THEN a DEPENDS_ON edge is created from A's node to B's node

#### Scenario: Guard assigned to endpoint creates PROTECTS edge

- GIVEN an IR endpoint with a lifecycle entry of kind `guard` referencing GuardG
- WHEN the Knowledge Graph builder processes it
- THEN a PROTECTS edge is created from GuardG's node to the Endpoint's node

## Cross-References

- **intermediate-representation**: `IrEndpoint.lifecycle` supplies the source data for PROTECTS/TRANSFORMS/INVOKES edges; `IrClass.injectedDependencies` supplies INJECTS edges.
- **visualization-views**: REQUEST_FLOW view consumes these node/edge types for step rendering; frontend `types.ts` must mirror the expanded enums.
