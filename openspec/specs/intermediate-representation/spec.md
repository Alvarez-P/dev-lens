# Intermediate Representation Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)
> **Updated by**: `request-flow-visualization` (2026-08-10) — `IrEndpoint.lifecycle`/`typedParams` projections, `LifecycleEntry`/`TypedParam` concepts, `constructorParams` on `IrClass`

## Purpose

The Intermediate Representation (IR) is the canonical, language-independent model produced by static analysis and consumed by all downstream capabilities. Per RFC-006 §7–10, the IR is immutable, serializable, and represents architectural concepts rather than language syntax.

## Requirements

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

Every IR node SHALL have a unique, stable identifier (e.g., `project:package:module:name`).

#### Scenario: TypeScript project produces IR with all concepts

- GIVEN a NestJS project with controllers, services, and DTOs
- WHEN the IR builder processes the parse results
- THEN the IR contains at least one Project, Package, Module, Class, Method, Endpoint, and Dependency

#### Scenario: Endpoint with decorated method projects lifecycle

- GIVEN a controller class with method `@UseGuards(AuthGuard) getUsers()`
- WHEN `buildEndpoints()` creates the IrEndpoint from the IrMethod
- THEN `IrEndpoint.lifecycle` contains `[{ kind: 'guard', classRef: 'AuthGuard' }]`
- AND `IrEndpoint.typedParams` reflects the method's `IrMethod.params`

### Requirement: IrEndpoint Lifecycle Projection

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

### Requirement: IrEndpoint TypedParams Projection

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

### Requirement: TS AST → IR Builder

The IR builder SHALL consume `ParseResult` objects and produce IR nodes. Builder output MUST be deterministic. Framework-specific constructs (e.g., NestJS decorators) SHALL be mapped to architectural roles, not preserved as raw decorators.

#### Scenario: NestJS controller mapped to IR

- GIVEN a `ParseResult` with a class classified as `controller` role
- WHEN the IR builder processes it
- THEN the resulting IR Class has role `controller`
- AND each `@Get()`, `@Post()` method produces an Endpoint with the correct HTTP method and path

### Requirement: IR Validator

The IR validator SHALL enforce structural, relationship, and referential integrity before the IR can be published. An invalid IR MUST NOT be persisted or published. Validation errors SHALL be collected and reported as a batch.

| Check        | Rule                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| Structural   | Every node has a valid identifier                                             |
| Relationship | Every `source`/`target` references an existing node                           |
| Referential  | Every `extends`/`implements` target exists in the IR                          |
| Required     | Every Project has at least one Package; every Package has at least one Module |

#### Scenario: Valid IR passes all checks

- GIVEN a structurally sound IR
- WHEN the validator runs
- THEN no errors are returned and the IR is cleared for publication

#### Scenario: Dangling reference blocked

- GIVEN an IR where a Dependency references a non-existent target node
- WHEN the validator runs
- THEN a referential integrity error is reported
- AND the IR is rejected for publication

#### Scenario: Batch error collection

- GIVEN an IR with both a missing identifier AND a dangling reference
- WHEN the validator runs
- THEN both errors are reported in a single validation result
- AND publication is blocked

### Requirement: IR Immutability

All IR nodes SHALL be immutable after construction. The IR published as an analysis result MUST NOT be modified. Subsequent analyses SHALL produce a new IR version identified by `snapshotId`.

#### Scenario: Attempted mutation is impossible

- GIVEN a published IR
- WHEN a consumer attempts to modify a node property
- THEN the operation is rejected (type-level or runtime enforcement)

## References

- RFC-006 §7–10 (IR Design), §13 (Immutability), §14 (Validation)
- EPIC-005 §2.5 (Domain Analysis), §2.7 (Metadata Generation)
- Knowledge Graph Model spec: `lifecycle` entries drive `PROTECTS`/`TRANSFORMS` edges; `typedParams` DTO types drive `DEPENDS_ON` (parameter-type) edges; `constructorParams` drive `INJECTS` edges
- TypeScript Parser spec: `IrMethod.decorators`/`IrMethod.params`/`IrClass.constructorParams` are the source data for the projections
- Visualization Views spec: the flow endpoint assembles `lifecycle` + `typedParams` + `constructorParams` into an ordered step sequence
