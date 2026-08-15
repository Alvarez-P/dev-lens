# TypeScript Parser Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)
> **Updated by**: `request-flow-visualization` (2026-08-10) — method-level `@UsePipes`/`@UseInterceptors` and parameter-level decorator roles (`@Body`/`@Param`/`@Query`/`@Headers`) in the `DecoratorRoleRegistry`
> **Updated by**: `ai-lifecycle-analysis` (2026-08-14) — decorator-role classification designated deterministic fallback; AI-classified roles override decorator-derived roles when enrichment is present

## Purpose

The TypeScript parser is the first concrete `LanguageParser` implementation. It wraps ts-morph to produce ASTs and classifies NestJS decorators into architectural roles. Per EPIC-005, initial language support covers TypeScript/JavaScript.

## Requirements

### Requirement: ts-morph AST Generation

The TypeScript parser SHALL use ts-morph to parse `.ts` and `.tsx` files. Each file SHALL produce a `ParseResult` with a ts-morph `SourceFile` AST node. Files with syntax errors SHALL return diagnostics, not throw.

#### Scenario: Valid TypeScript file parsed

- GIVEN a `.ts` file with valid syntax
- WHEN `TypeScriptParser.parse(file)` is called
- THEN `ParseResult.ast` is a ts-morph `SourceFile` and `diagnostics` is empty

#### Scenario: Invalid TypeScript produces diagnostics

- GIVEN a `.ts` file with mismatched braces
- WHEN `TypeScriptParser.parse(file)` is called
- THEN `ParseResult.ast` is null and `diagnostics` includes a syntax error with line number

### Requirement: NestJS Decorator Classification

The parser SHALL classify NestJS decorators into architectural roles. Recognized decorator-to-role mappings SHALL include at minimum:

| Decorator                                      | Role               |
| ---------------------------------------------- | ------------------ |
| `@Controller()`                                | `controller`       |
| `@Injectable()`                                | `service`          |
| `@Module()`                                    | `module`           |
| `@Injectable()` + `implements CanActivate`     | `guard`            |
| `@Injectable()` + `implements NestInterceptor` | `interceptor`      |
| `@Injectable()` + `implements PipeTransform`   | `pipe`             |
| `@EntityRepository()`                          | `repository`       |
| `@Catch()`                                     | `exception-filter` |
| `@UseGuards()`                                 | `guard`            |
| `@Middleware()`                                | `middleware`       |
| `@UsePipes()`                                  | `pipe`             |
| `@UseInterceptors()`                           | `interceptor`      |

**Parameter-level decorators** (method parameter classification):

| Decorator    | Role      |
| ------------ | --------- |
| `@Body()`    | `body`    |
| `@Param()`   | `param`   |
| `@Query()`   | `query`   |
| `@Headers()` | `headers` |

Role classification MUST be attached to the ParseResult as metadata for the IR builder.

Decorator-role classification SHALL be designated the DETERMINISTIC FALLBACK. When AI enrichment is present for a unit, AI-classified roles SHALL override the decorator-derived role for that unit. When enrichment is absent or disabled, the decorator-derived role SHALL remain in effect.

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

#### Scenario: AI-classified role overrides decorator role

- GIVEN a class annotated `@Injectable()` with no role interface, whose unit has AI enrichment classifying it as `interceptor`
- WHEN roles are resolved for that unit
- THEN the AI-classified role `interceptor` SHALL override the decorator-derived `service` role

### Requirement: Method-Level Decorator Registry Additions

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

### Requirement: Parameter Decorator Registry Additions

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

### Requirement: Deterministic Output

Given the same input file content, the TypeScript parser SHALL produce identical `ParseResult` output — including decorator classifications — on every invocation.

#### Scenario: Repeated parse is identical

- GIVEN the same `.ts` file content
- WHEN `TypeScriptParser.parse()` is called twice
- THEN both `ParseResult` outputs are structurally identical

## References

- RFC-006 §11 (Language Independence)
- EPIC-005 §2.3 (Source Code Parsing), §2.4 (Architecture Discovery)
- NestJS [decorator reference](https://docs.nestjs.com/custom-decorators)
