# Delta for knowledge-graph-model

## ADDED Requirements

### [NEW] Requirement: INVOKES Edge — Approximate Call Chain

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

### [NEW] Requirement: INJECTS Edge — Constructor Dependency Injection

The system SHALL add an `INJECTS` edge type representing constructor-based dependency injection. The edge SHALL flow from the dependent class to the injected dependency. The edge SHALL be derived from `IrClass.constructorParams` (already populated by ai-enrichment). No method-body analysis SHALL be used.

#### Scenario: Single injection creates INJECTS edge

- GIVEN a class `UsersController` with constructor `constructor(private svc: UsersService)`
- WHEN the Semantic Model builder processes it
- THEN an `INJECTS` edge is created from `UsersController` to `UsersService`

#### Scenario: Multiple injections produce one edge each

- GIVEN a class with `constructor(private a: ServiceA, private b: ServiceB)`
- WHEN the Semantic Model builder processes it
- THEN two `INJECTS` edges are created: one to ServiceA, one to ServiceB

### [NEW] Requirement: Endpoint-to-DTO Typing Edges

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

### [NEW] Requirement: Flow Availability on Graph Snapshots

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

## MODIFIED Requirements

### Requirement: Graph Edge Types

The system SHALL model relationships using the following directed edge types:

| Edge       | Source                        | Target                 | Trigger                                                         | Status       |
| ---------- | ----------------------------- | ---------------------- | --------------------------------------------------------------- | ------------ |
| BELONGS_TO | Any node                      | Module/Package/Project | Structural containment                                          | Existing     |
| DEPENDS_ON | Any node                      | Any node               | Import statement OR parameter-type ref                          | Existing+    |
| IMPLEMENTS | Class                         | Interface              | `implements` clause                                             | Existing     |
| EXTENDS    | Class                         | Class                  | `extends` clause                                                | Existing     |
| EXPOSES    | Controller                    | Endpoint               | Method with HTTP decorator                                      | Existing     |
| IMPORTS    | Module                        | ExternalDependency     | Unresolved external import                                      | Existing     |
| PROTECTS   | Guard                         | Controller OR Endpoint | `@UseGuards` (class-level DONE, ep-level NEW)                   | [DONE]+[NEW] |
| TRANSFORMS | Pipe, Interceptor, Middleware | Controller OR Endpoint | `@UsePipes`/`@UseInterceptors` (class-level DONE, ep-level NEW) | [DONE]+[NEW] |
| INVOKES    | Controller, Service           | Service, Repository    | Constructor DI order (approximate)                              | [NEW]        |
| INJECTS    | Any Class                     | Any Class              | Constructor injection                                           | [NEW]        |

(Previously: 6 edge types — BELONGS_TO/DEPENDS_ON/IMPLEMENTS/EXTENDS/EXPOSES/IMPORTS only)

> **Correction from stale delta**: The previous version of this delta incorrectly mapped `INVOKES` as "Interceptor → Endpoint". Interceptors use `TRANSFORMS` (they transform requests/responses). `INVOKES` represents the approximate call chain (Controller→Service→Repository) derived from DI order + import reachability.

#### Scenario: Import dependency maps to DEPENDS_ON edge

- GIVEN an IR dependency from Module A to Module B with type `import`
- WHEN the Knowledge Graph builder processes it
- THEN a DEPENDS_ON edge is created from A's node to B's node

#### Scenario: Guard assigned to endpoint creates PROTECTS edge [NEW — endpoint-level]

- GIVEN an IrEndpoint with lifecycle entry `{ kind: 'guard', classRef: 'JwtGuard' }`
- WHEN the Semantic Model builder processes it
- THEN a PROTECTS edge is created from the Guard's lifecycle node (FQN `${cls.fqn}~guard:JwtGuard`) to the Endpoint node

#### Scenario: Class-level PROTECTS edge continues to work [DONE]

- GIVEN an ai-enrichment lifecycle entry `guard:JwtGuard` on a controller class
- WHEN the Semantic Model builder processes it
- THEN a PROTECTS edge is created from the Guard's lifecycle node to the Controller node
- (Existing behavior from ai-enrichment; untouched by this change)

## Cross-References

- **intermediate-representation**: `IrEndpoint.lifecycle` projection supplies endpoint-level PROTECTS/TRANSFORMS edges. `IrEndpoint.typedParams` projection drives DEPENDS_ON (parameter-type) edges. `IrClass.constructorParams` maps to INJECTS edges. The INVOKES chain derives from INJECTS + DEPENDS_ON reachability.
- **typescript-parser**: `decorator-role-registry.ts` additions (`@UsePipes`, `@UseInterceptors`, `@Body`, `@Param`, `@Query`, `@Headers`) enable the IR projection that feeds these edges.
- **visualization-views**: REQUEST_FLOW view consumes INVOKES/INJECTS edges for the approximate service tail. Frontend `EdgeType` enum must mirror the 2 new edge types (8→10).
- **ai-enrichment**: Class-level PROTECTS/TRANSFORMS edges from `addLifecycleNodes()` are untouched. Endpoint-level edges extend the same lifecycle-node FQN scheme (`${cls.fqn}~kind:name`) — deduplication by FQN prevents duplicate nodes.
