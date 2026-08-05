# TypeScript Parser Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)

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

| Decorator                                      | Role          |
| ---------------------------------------------- | ------------- |
| `@Controller()`                                | `controller`  |
| `@Injectable()`                                | `service`     |
| `@Module()`                                    | `module`      |
| `@Injectable()` + `implements CanActivate`     | `guard`       |
| `@Injectable()` + `implements NestInterceptor` | `interceptor` |
| `@Injectable()` + `implements PipeTransform`   | `pipe`        |
| `@EntityRepository()`                          | `repository`  |

Role classification MUST be attached to the ParseResult as metadata for the IR builder.

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
