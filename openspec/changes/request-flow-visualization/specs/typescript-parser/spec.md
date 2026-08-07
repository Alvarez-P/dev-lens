# Delta for typescript-parser

## ADDED Requirements

### Requirement: Method-Level Decorator Extraction

The TypeScript parser SHALL extract method-level decorators: `@UseGuards(...args)`, `@UsePipes(...args)`, `@UseInterceptors(...args)`, and `@Middleware(...args)` (NestJS Express/Fastify middleware). Each decorator SHALL produce a lifecycle entry with `kind` and `classRef`. The `classRef` MUST be a concrete class reference deterministically resolved from the decorator argument. The order of extraction SHALL match declaration order.

#### Scenario: Single guard extracted per method

- GIVEN a controller method with `@UseGuards(JwtAuthGuard)`
- WHEN the TypeScript parser processes the method
- THEN the parse result includes a lifecycle entry `{ kind: 'guard', classRef: 'JwtAuthGuard' }` for that method

#### Scenario: Multiple guards preserve order

- GIVEN a method with `@UseGuards(AuthGuard, RoleGuard)`
- WHEN the TypeScript parser processes it
- THEN lifecycle entries are extracted in order: `AuthGuard` first, `RoleGuard` second

#### Scenario: Unsupported decorator form omitted — APP_GUARD

- GIVEN a module class with `providers: [{ provide: APP_GUARD, useClass: JwtGuard }]`
- WHEN the TypeScript parser processes the file
- THEN no lifecycle entry is produced for the APP_GUARD registration
- AND parsing continues without error

#### Scenario: Unsupported decorator form omitted — factory function

- GIVEN a method with `@UseGuards(ThrottlerGuard.forRoot({ ttl: 60 }))` (factory call, not a class reference)
- WHEN the TypeScript parser processes it
- THEN no lifecycle entry is produced for this guard
- AND parsing continues without error

### Requirement: Parameter Type Annotation Extraction

The TypeScript parser SHALL extract parameter type annotations from endpoint method signatures. Each parameter SHALL produce a `TypedParam` with `name`, `typeAnnotation` (TypeScript type as string), and `decorator` (the NestJS parameter decorator: `@Body`, `@Param`, `@Query`, `@Headers`). Built-in types (`string`, `number`, `boolean`) SHALL be extracted as type annotations. Unresolvable type references SHALL be omitted, never guessed.

#### Scenario: DTO parameter extracted

- GIVEN a method `create(@Body() dto: CreateUserDto)`
- WHEN the TypeScript parser processes it
- THEN the typed param is `{ name: 'dto', typeAnnotation: 'CreateUserDto', decorator: '@Body' }`

#### Scenario: Query parameter with primitive type

- GIVEN a method `findAll(@Query('page') page: number)`
- WHEN the TypeScript parser processes it
- THEN the typed param is `{ name: 'page', typeAnnotation: 'number', decorator: '@Query' }`

#### Scenario: Unresolvable type omitted

- GIVEN a method with `@Body() data: SomeGenericType<T>` where T cannot be resolved
- WHEN the TypeScript parser processes it
- THEN the typed param has `typeAnnotation: null`
- AND parsing continues without error

### Requirement: Constructor Injection Extraction

The TypeScript parser SHALL extract constructor-injected dependencies from NestJS classes. Each constructor parameter SHALL produce an injection entry with `name` and `typeAnnotation`. The parser MUST use only AST-level extraction (parameter declarations) and MUST NOT perform method-body analysis. Classes without constructors or with zero-parameter constructors SHALL produce an empty injection list.

#### Scenario: Single injection extracted

- GIVEN a service class with `constructor(private readonly prisma: PrismaService) {}`
- WHEN the TypeScript parser processes it
- THEN the injection list contains `{ name: 'prisma', typeAnnotation: 'PrismaService' }`

#### Scenario: Multiple injections extracted

- GIVEN a class with `constructor(private a: ServiceA, private b: ServiceB) {}`
- WHEN the TypeScript parser processes it
- THEN the injection list contains two entries in declaration order

#### Scenario: No constructor yields empty list

- GIVEN a class without any constructor
- WHEN the TypeScript parser processes it
- THEN `injectedDependencies` is an empty array

## Cross-References

- **intermediate-representation**: parse results feed `IrEndpoint.lifecycle`, `IrEndpoint.typedParams`, and `IrClass.injectedDependencies`.
- **knowledge-graph-model**: extracted lifecycle classRefs become Guard/Pipe/Interceptor/Middleware nodes; injection classRefs drive INJECTS edges.
- **visualization-views**: parsed data flows through IR → graph → flow API → frontend animation.
