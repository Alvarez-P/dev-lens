# Delta for intermediate-representation

> **Naming reconciliation (2026-08-07)**: This delta has been re-baselined against the actual code after ai-enrichment merged. The stale delta used `IrClass.injectedDependencies` (does not exist — code has `constructorParams`), `IrEndpoint.lifecycle` (does not exist — data lives on `IrMethod.decorators`), and `IrEndpoint.typedParams` (does not exist — data lives on `IrMethod.params`). This delta describes projection fields built from existing IR data.

## ADDED Requirements

### [NEW] Requirement: IrEndpoint Lifecycle Projection

`IrEndpoint` SHALL gain a `lifecycle` field — an ordered list of lifecycle steps projected from the owning `IrMethod.decorators`. Each step SHALL have `kind` (`guard | pipe | interceptor | middleware`) and `classRef` (the FQN resolved from the decorator argument). The projection SHALL happen in `buildEndpoints()` — each `IrEndpoint` already knows its owning `IrMethod` via the build context. An endpoint whose method has no lifecycle decorators SHALL have an empty `lifecycle` list. Declaration order SHALL be preserved.

#### Scenario: Method with @UseGuards projects lifecycle onto IrEndpoint

- GIVEN a controller method `@UseGuards(AuthGuard) getUsers()` producing `IrMethod.decorators = ['@UseGuards(AuthGuard)']`
- WHEN `buildEndpoints()` projects the method onto the resulting `IrEndpoint`
- THEN `IrEndpoint.lifecycle` contains `[{ kind: 'guard', classRef: 'AuthGuard' }]`

#### Scenario: Multiple guards preserve order

- GIVEN a method `@UseGuards(AuthGuard, RoleGuard)` producing two decorator entries
- WHEN `buildEndpoints()` projects onto `IrEndpoint`
- THEN `lifecycle` is `[{ kind: 'guard', classRef: 'AuthGuard' }, { kind: 'guard', classRef: 'RoleGuard' }]`

#### Scenario: Endpoint with no decorators

- GIVEN a controller method with no lifecycle decorators on the method
- WHEN `buildEndpoints()` projects it
- THEN `IrEndpoint.lifecycle` is `[]`

### [NEW] Requirement: IrEndpoint TypedParams Projection

`IrEndpoint` SHALL gain a `typedParams` field — an ordered list of `{ name, typeAnnotation, decorator }` objects projected from the owning `IrMethod.params`. `typeAnnotation` is the TypeScript type as a string (e.g., `'CreateUserDto'`). `decorator` is the NestJS parameter decorator (`@Body`, `@Param`, `@Query`, `@Headers`). Parameters without a decorator or resolvable type SHALL have `null` for the missing field. The projection SHALL happen in `buildEndpoints()` alongside the lifecycle projection.

#### Scenario: @Body() DTO parameter projected

- GIVEN a controller method `create(@Body() dto: CreateUserDto)` producing `IrMethod.params[0] = { name: 'dto', type: 'CreateUserDto', decorators: ['Body'] }`
- WHEN `buildEndpoints()` projects onto `IrEndpoint`
- THEN `typedParams` contains `{ name: 'dto', typeAnnotation: 'CreateUserDto', decorator: '@Body' }`

#### Scenario: @Query() primitive type projected without DTO edge

- GIVEN a method `findAll(@Query('page') page: number)` producing `IrMethod.params[0] = { name: 'page', type: 'number', decorators: ['Query'] }`
- WHEN `buildEndpoints()` projects onto `IrEndpoint`
- THEN `typedParams` contains `{ name: 'page', typeAnnotation: 'number', decorator: '@Query' }`

#### Scenario: Undecorated parameter has null decorator

- GIVEN a method `handler(body: any)` with no parameter decorators
- WHEN projected onto `IrEndpoint`
- THEN `typedParams` entry has `decorator: null`

### [DONE] Requirement: IrMethod Decorators and Params (ai-enrichment)

> Already implemented by ai-enrichment. Kept here for context only.

`IrMethod.decorators` (string array, e.g. `['@UseGuards(JwtGuard)']`) and `IrMethod.params` (`IrParameter[]` with `{ name, type, decorators }`) were added by ai-enrichment. These fields are the SOURCE of truth for the `IrEndpoint.lifecycle` and `IrEndpoint.typedParams` projections above. No changes needed to these fields.

### [DONE] Requirement: IrClass ConstructorParams (ai-enrichment)

> Already implemented by ai-enrichment. Kept here for context only.

`IrClass.constructorParams` (`IrParameter[]` with `{ name, type, decorators }`) was added by ai-enrichment. This field is consumed by the AI sketch builder and SHALL now additionally feed `INJECTS` edges in the Semantic Model builder. No changes needed to this field — the code uses `constructorParams`, not `injectedDependencies` (the stale delta name).

## MODIFIED Requirements

### Requirement: IR Domain Model

The IR SHALL model the following concepts as immutable value objects:

| Concept      | Key Fields                                                  | Relationships                           |
| ------------ | ----------------------------------------------------------- | --------------------------------------- |
| Project      | name, rootPath, language                                    | contains Packages                       |
| Package      | name, version                                               | contains Modules                        |
| Module       | name, path                                                  | contains Classes, Interfaces, Functions |
| Class        | name, isAbstract, isExported, decorators, constructorParams | extends Class, implements Interface     |
| Interface    | name                                                        | extended by Classes                     |
| Function     | name, isAsync, isExported                                   | —                                       |
| Method       | name, visibility, isStatic, decorators, params, returnType  | belongs to Class                        |
| Endpoint     | httpMethod, path, parameters, lifecycle, typedParams        | belongs to Class                        |
| Dependency   | source, target, type                                        | connects any two IR nodes               |
| Relationship | kind, from, to                                              | explicit named relation                 |
| Lifecycle    | kind, classRef                                              | referenced by Endpoint                  |
| TypedParam   | name, typeAnnotation, decorator                             | referenced by Endpoint                  |

Every IR node SHALL have a unique, stable identifier.

(Previously: `IrEndpoint` had `parameters: string[]` only; `IrClass`/`IrMethod` had no decorator/param/constructor fields; no Lifecycle/TypedParam concepts)

#### Scenario: TypeScript project produces IR with all concepts

- GIVEN a NestJS project with controllers, services, and DTOs
- WHEN the IR builder processes the parse results
- THEN the IR contains at least one Project, Package, Module, Class, Method, Endpoint, and Dependency

#### Scenario: Endpoint with decorated method projects lifecycle [NEW]

- GIVEN a controller class with method `@UseGuards(AuthGuard) getUsers()`
- WHEN `buildEndpoints()` creates the IrEndpoint from the IrMethod
- THEN `IrEndpoint.lifecycle` contains `[{ kind: 'guard', classRef: 'AuthGuard' }]`
- AND `IrEndpoint.typedParams` reflects the method's `IrMethod.params`

## Cross-References

- **knowledge-graph-model**: `lifecycle` entries drive `PROTECTS`/`TRANSFORMS` edges (endpoint-level). `typedParams` entries with DTO types drive `DEPENDS_ON` (parameter-type) edges. `constructorParams` drive `INJECTS` edges.
- **typescript-parser**: parser populates `IrMethod.decorators`/`IrMethod.params`/`IrClass.constructorParams` — the source data for these projections.
- **visualization-views**: flow endpoint assembles `lifecycle` + `typedParams` + `constructorParams` into an ordered step sequence with payload types.
