# Delta for intermediate-representation

## MODIFIED Requirements

### Requirement: IR Domain Model

The IR SHALL model the following concepts as immutable value objects:

| Concept      | Key Fields                                           | Relationships                           |
| ------------ | ---------------------------------------------------- | --------------------------------------- |
| Project      | name, rootPath, language                             | contains Packages                       |
| Package      | name, version                                        | contains Modules                        |
| Module       | name, path                                           | contains Classes, Interfaces, Functions |
| Class        | name, isAbstract, isExported, injectedDependencies   | extends Class, implements Interface     |
| Interface    | name                                                 | extended by Classes                     |
| Function     | name, isAsync, isExported                            | —                                       |
| Method       | name, visibility, isStatic                           | belongs to Class                        |
| Endpoint     | httpMethod, path, parameters, lifecycle, typedParams | belongs to Class                        |
| Dependency   | source, target, type                                 | connects any two IR nodes               |
| Relationship | kind, from, to                                       | explicit named relation                 |
| Lifecycle    | kind, classRef                                       | referenced by Endpoint                  |
| TypedParam   | name, typeAnnotation, decorator                      | referenced by Endpoint                  |
| Injection    | name, typeAnnotation                                 | referenced by Class                     |

Every IR node SHALL have a unique, stable identifier.

(Previously: `IrEndpoint` had `parameters: string[]` only; `IrClass` had no DI field; no Lifecycle/TypedParam/Injection concepts)

#### Scenario: TypeScript project produces IR with all concepts

- GIVEN a NestJS project with controllers, services, and DTOs
- WHEN the IR builder processes the parse results
- THEN the IR contains at least one Project, Package, Module, Class, Method, Endpoint, and Dependency

#### Scenario: Endpoint with guards produces lifecycle entries

- GIVEN a controller method annotated with `@UseGuards(AuthGuard)`
- WHEN the IR builder processes the parse results
- THEN the resulting IrEndpoint has a lifecycle entry with `kind: 'guard'` and `classRef: 'AuthGuard'`

## ADDED Requirements

### Requirement: IrEndpoint Lifecycle Field

`IrEndpoint.lifecycle` SHALL be an ordered list of lifecycle steps. Each step MUST have `kind` (`guard | pipe | interceptor | middleware`) and `classRef` (the FQN of the class implementing the lifecycle role). The order SHALL preserve the decorator declaration order from source code. An endpoint without decorations SHALL have an empty lifecycle list.

#### Scenario: Multiple guards on one endpoint

- GIVEN a method with `@UseGuards(AuthGuard, RoleGuard)`
- WHEN the IR builder processes it
- THEN lifecycle contains two entries: `{ kind: 'guard', classRef: 'AuthGuard' }` followed by `{ kind: 'guard', classRef: 'RoleGuard' }`

#### Scenario: Endpoint with no decorators

- GIVEN a controller method with no lifecycle decorators
- WHEN the IR builder processes it
- THEN `lifecycle` is an empty array

### Requirement: IrEndpoint TypedParams Field

`IrEndpoint.typedParams` SHALL be a list of `{ name, typeAnnotation, decorator }` objects. `typeAnnotation` is the TypeScript type as a string (e.g., `'CreateUserDto'`). `decorator` is the parameter decorator name (e.g., `'@Body'`, `'@Param'`). Parameters without a decorator or type annotation SHALL have `null` for the missing field.

#### Scenario: Body parameter extracted with type

- GIVEN a method signature `create(@Body() dto: CreateUserDto)`
- WHEN the IR builder processes it
- THEN typedParams contains `{ name: 'dto', typeAnnotation: 'CreateUserDto', decorator: '@Body' }`

### Requirement: IrClass InjectedDependencies Field

`IrClass.injectedDependencies` SHALL be a list of `{ name, typeAnnotation }` objects extracted from constructor parameters. A class without a constructor or with a parameterless constructor SHALL have an empty list. Only deterministic AST extraction SHALL be used — never guess injection targets.

#### Scenario: Constructor injection extracted

- GIVEN a class with constructor `constructor(private userService: UserService)`
- WHEN the IR builder processes it
- THEN `injectedDependencies` contains `{ name: 'userService', typeAnnotation: 'UserService' }`

## Cross-References

- **knowledge-graph-model**: `lifecycle` entries become `GUARD/PIPE/INTERCEPTOR/MIDDLEWARE` nodes + `PROTECTS/TRANSFORMS/INVOKES` edges. `injectedDependencies` become `INJECTS` edges.
- **typescript-parser**: parser extracts `lifecycle`, `typedParams`, and `injectedDependencies` from AST and passes them to the IR builder.
- **visualization-views**: the flow endpoint assembles `lifecycle` + `injectedDependencies` into an ordered step sequence.
