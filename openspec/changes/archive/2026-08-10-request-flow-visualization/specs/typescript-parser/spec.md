# Delta for typescript-parser

> **Re-baselined 2026-08-07**: Method-level decorator extraction (`IrMethod.decorators`), parameter-type annotation extraction (`IrMethod.params`), and constructor-injection extraction (`IrClass.constructorParams`) were ALL delivered by ai-enrichment. The parser infrastructure already walks decorators with arguments, extracts parameter types, and captures constructor signatures. This delta focuses on the MISSING registry entries and the parameter-decorator → DTO resolution mapping.

## ADDED Requirements

### [NEW] Requirement: Method-Level Decorator Registry Additions

The `DecoratorRoleRegistry` SHALL register `UsePipes` → role `pipe` and `UseInterceptors` → role `interceptor`. These entries enable the existing decorator-walking infrastructure to classify method-level `@UsePipes(...)` and `@UseInterceptors(...)` decorators as lifecycle roles. The existing `UseGuards` → `guard` and `Middleware` → `middleware` entries are already registered.

#### Scenario: @UsePipes classified as pipe role

- GIVEN a controller class with method `@UsePipes(ValidationPipe) create()`
- WHEN the TypeScript parser processes the decorators
- THEN the `UsePipes` decorator is classified with role `pipe`

#### Scenario: @UseInterceptors classified as interceptor role

- GIVEN a controller class with method `@UseInterceptors(LoggingInterceptor) get()`
- WHEN the TypeScript parser processes the decorators
- THEN the `UseInterceptors` decorator is classified with role `interceptor`

#### Scenario: @UseGuards still classified as guard (regression check)

- GIVEN a controller class with method `@UseGuards(JwtGuard) get()`
- WHEN the TypeScript parser processes it
- THEN the decorator is classified with role `guard`
- (Existing behavior from ai-enrichment — unaffected by registry additions)

### [NEW] Requirement: Parameter Decorator Registry Additions

The `DecoratorRoleRegistry` SHALL register `Body` → role `body`, `Param` → role `param`, `Query` → role `query`, and `Headers` → role `headers`. These entries SHALL enable the parser to identify which NestJS parameter decorator is applied to each method parameter. The classification SHALL be consumed by `buildEndpoints()` when projecting `IrEndpoint.typedParams`.

#### Scenario: @Body() parameter identified

- GIVEN a method signature `create(@Body() dto: CreateUserDto)`
- WHEN the TypeScript parser processes the parameter's decorators
- THEN the parameter's decorator list includes `Body`
- AND `getRole('Body')` returns `'body'`

#### Scenario: @Query() parameter identified

- GIVEN a method signature `findAll(@Query('status') status: string)`
- WHEN the TypeScript parser processes it
- THEN the parameter's decorator list includes `Query`
- AND `getRole('Query')` returns `'query'`

#### Scenario: Multi-decorator parameter supported

- GIVEN a method signature `update(@Param('id') @Body() dto: UpdateDto)`
- WHEN the TypeScript parser processes the parameter
- THEN the parameter's decorator list contains both `Param` and `Body`

### [DONE] Requirement: Method-Level Decorator Extraction (ai-enrichment)

> Already implemented. `buildMethod()` in `typescript-ir-builder.ts` populates `IrMethod.decorators` (string array) and `IrMethod.params` (IrParameter[]). No changes to extraction logic — only registry additions above are needed.

#### Scenario: Single guard extracted per method

- GIVEN a controller method with `@UseGuards(JwtAuthGuard)`
- WHEN the TypeScript parser processes the method
- THEN `IrMethod.decorators` includes `'@UseGuards(JwtAuthGuard)'`

#### Scenario: Factory-call decorator extracted but unresolvable

- GIVEN a method with `@UseGuards(ThrottlerGuard.forRoot({ ttl: 60 }))`
- WHEN the TypeScript parser processes it
- THEN the decorator text is stored verbatim in `IrMethod.decorators`
- BUT no classRef is resolved (factory call, not a class reference)
- AND parsing continues without error

### [DONE] Requirement: Constructor Injection Extraction (ai-enrichment)

> Already implemented. `buildConstructorParams()` in `typescript-ir-builder.ts` populates `IrClass.constructorParams`. The IR data is already consumed by the AI sketch builder. This change SHALL additionally consume it in the Semantic Model builder to create `INJECTS` edges.

#### Scenario: Single injection extracted

- GIVEN a service class with `constructor(private readonly prisma: PrismaService) {}`
- WHEN the TypeScript parser processes it
- THEN `IrClass.constructorParams` contains `[{ name: 'prisma', type: 'PrismaService', decorators: [] }]`

#### Scenario: No constructor yields empty list

- GIVEN a class without any constructor
- WHEN the TypeScript parser processes it
- THEN `constructorParams` is `[]`

## MODIFIED Requirements

### Requirement: NestJS Decorator Classification

The parser SHALL classify NestJS decorators into architectural roles. Recognized decorator-to-role mappings SHALL include at minimum:

| Decorator                                      | Role               | Status    |
| ---------------------------------------------- | ------------------ | --------- |
| `@Controller()`                                | `controller`       | Existing  |
| `@Injectable()`                                | `service`          | Existing  |
| `@Module()`                                    | `module`           | Existing  |
| `@Injectable()` + `implements CanActivate`     | `guard`            | Existing  |
| `@Injectable()` + `implements NestInterceptor` | `interceptor`      | Existing  |
| `@Injectable()` + `implements PipeTransform`   | `pipe`             | Existing  |
| `@EntityRepository()`                          | `repository`       | Existing  |
| `@Catch()`                                     | `exception-filter` | Existing  |
| `@UseGuards()`                                 | `guard`            | Existing  |
| `@Middleware()`                                | `middleware`       | Existing  |
| `@UsePipes()`                                  | `pipe`             | **[NEW]** |
| `@UseInterceptors()`                           | `interceptor`      | **[NEW]** |

**Parameter-level decorators** (new in registry):

| Decorator    | Role      | Status    |
| ------------ | --------- | --------- |
| `@Body()`    | `body`    | **[NEW]** |
| `@Param()`   | `param`   | **[NEW]** |
| `@Query()`   | `query`   | **[NEW]** |
| `@Headers()` | `headers` | **[NEW]** |

Role classification MUST be attached to the ParseResult as metadata for the IR builder.

(Previously: class-level decorators only; no method-level @UsePipes/@UseInterceptors; no parameter decorators)

#### Scenario: Controller decorator classified

- GIVEN a class annotated with `@Controller('users')`
- WHEN the TypeScript parser processes it
- THEN the class is classified with role `controller`
- AND the route prefix `'users'` is extracted as metadata

#### Scenario: Injectable without role interface classified as generic service

- GIVEN a class annotated with `@Injectable()` with no guard/interceptor/pipe interface
- WHEN the TypeScript parser processes it
- THEN the class is classified with role `service`

#### Scenario: Unrecognized decorator ignored

- GIVEN a class with only `@CustomDecorator()`
- WHEN the TypeScript parser processes it
- THEN no architectural role is assigned
- AND parsing continues without error

## Cross-References

- **intermediate-representation**: Registry roles for `UsePipes`/`UseInterceptors` feed into `IrEndpoint.lifecycle` projection. Parameter decorator roles (`Body`/`Param`/`Query`/`Headers`) feed into `IrEndpoint.typedParams` projection.
- **knowledge-graph-model**: Classified lifecycle entries become `PROTECTS`/`TRANSFORMS` edges (endpoint-level). `constructorParams` drive `INJECTS` edges. Parameter types drive `DEPENDS_ON` (parameter-type) edges.
- **visualization-views**: Flow endpoint consumes the lifecycle order + typed params from the IR projection.
