# Delta for TypeScript Parser

## MODIFIED Requirements

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

(Previously: decorator classification was the primary role source; AI enrichment did not override it.)

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
