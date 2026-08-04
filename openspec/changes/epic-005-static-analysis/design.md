# Design: EPIC-005 — Static Analysis Engine

## Technical Approach

Per RFC-006: deterministic pipeline from snapshot to immutable IR, driven by domain events. Strategy pattern for language parsers (`ParserRegistry` resolves `LanguageParser` by language identifier). IR is JSONB-persisted alongside a content-hash manifest for incremental re-analysis. Trigger flow: `RepositorySynchronizedEvent` → registered handler → BullMQ `analysis` queue → `StaticAnalysisService` → persist → `analysis.completed`.

## Architecture Decisions

| Decision                        | Choice                                                                                                                            | Rationale                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decorator mapping extensibility | `DecoratorRoleRegistry` — injectable class with default NestJS mappings; `register(name, role)` for extensibility                 | Open/closed principle: new decorators added without touching parser core. Defaults cover NestJS; teams extending custom decorators use the same registry |
| Full re-parse threshold         | `>50%` changed files OR missing previous IR → full re-parse. Configurable via `STATIC_ANALYSIS_THRESHOLD` env var (default `0.5`) | 50% is the natural tipping point where partial merge overhead exceeds full re-parse cost. Configurable so repos with different change patterns can tune  |
| Manifest storage                | `Analysis` entity `fileManifest` JSONB column (alongside `ir` JSONB) — `Record<filePath, SHA-256>`                                | Co-location with IR: single query loads both for comparison. JSONB avoids schema migration pain as IR evolves                                            |

## Domain Model

```
Analysis (aggregate)
├── AnalysisId (Identifier<string>)
├── snapshotId (SnapshotId)
├── repositoryId (RepositoryId)
├── status: PENDING | PROCESSING | COMPLETED | FAILED
├── ir: IrProject | null          ← JSONB
├── fileManifest: Record<string, string> | null  ← JSONB
├── createdAt, updatedAt
```

**IR Value Objects** (immutable, `ValueObject`):

```
IrProject → contains IrPackage[]
IrPackage → contains IrModule[]
IrModule → contains IrClass[], IrInterface[], IrFunction[]
IrClass → role?, IrMethod[], IrEndpoint[], extends?, implements[]
IrMethod → visibility, isStatic, parameters
IrEndpoint → httpMethod, path, parameters
IrFunction → isAsync, isExported
IrDependency → source(fqn), target(fqn), type
IrRelationship → kind, from, to
```

Stable identifier: `fqn = project:package:module:#name`.

**Parser contracts** (domain interfaces):

```
LanguageParser → parse(file: ParsedFile): ParseResult
ParserRegistry → register(language, parser): void
              → get(language): LanguageParser
ParsedFile → path, content, language
ParseResult → filePath, language, ast (any | null), diagnostics: Diagnostic[]
               + metadata: Record<string, unknown> (decorator roles, etc.)
```

## Data Flow

```
repository.synchronized event
    │
    ▼
registered handler ──► BullMQ 'analysis' queue ──► AnalysisJobProcessor
                                                         │
                                            StaticAnalysisService.analyze(snapshotId)
                                                         │
                                    1. load Snapshot via SnapshotRepository
                                    2. walk repo files (GitService.getRepoPath)
                                    3. LanguageDetector → Map<Language, FilePath[]>
                                    4. for each (language, files):
                                         ParserRegistry.get(language).parse(file)
                                    5. TypeScriptIrBuilder.build(parseResults) → IrProject
                                    6. IrValidator.validate(ir) → ValidationResult
                                    7. AnalysisRepository.save(analysis, ir, manifest)
                                    8. DomainEventDispatcher.dispatch(analysis.completed)
```

## Module Structure

```
src/backend/src/modules/analysis/
├── analysis.module.ts
├── domain/
│   ├── index.ts
│   ├── analysis.entity.ts
│   ├── analysis-id.vo.ts
│   ├── analysis-status.enum.ts
│   ├── analysis-errors.ts
│   ├── analysis-events.ts
│   ├── parsed-file.vo.ts
│   ├── parse-result.vo.ts
│   ├── language.vo.ts
│   ├── ir-nodes.ts                    # IrProject, IrModule, IrClass, etc.
│   ├── interfaces/
│   │   ├── language-parser.interface.ts
│   │   └── parser-registry.interface.ts
│   └── services/
│       ├── language-detector.service.ts
│       └── ir-validator.service.ts
├── application/
│   └── static-analysis.service.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── typeorm/
│   │   │   └── analysis.typeorm-entity.ts
│   │   └── repositories/
│   │       └── analysis.repository.ts
│   ├── parsers/
│   │   ├── parser-registry.ts         # InMemoryParserRegistry
│   │   ├── decorator-role-registry.ts
│   │   └── typescript/
│   │       ├── typescript-parser.ts
│   │       └── typescript-ir-builder.ts
│   └── jobs/
│       └── analysis.job-processor.ts
└── index.ts
```

## Per-Slice Design

| Slice  | Deliverables                                                                                                                                                                                                                                                          | Clear Interface                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **C1** | `Language`, `ParsedFile`, `ParseResult`, `LanguageParser` interface, `ParserRegistry` interface, `InMemoryParserRegistry`, `TypeScriptParser` (ts-morph), `DecoratorRoleRegistry`, `LanguageDetector`, analysis events + `registerHandler` on `DomainEventDispatcher` | `ParseResult` contract — testable with fixture `.ts` files                                      |
| **C2** | All `IrNode` VOs, `TypeScriptIrBuilder`, `IrValidator`, `Analysis` entity, `AnalysisId`, `AnalysisRepository`                                                                                                                                                         | IR models → validator → repository (no pipeline yet). Round-trip: fixture AST → IR → serialized |
| **C3** | `StaticAnalysisService`, `AnalysisJobProcessor`, `AnalysisModule` NestJS wiring, BullMQ `analysis` queue, `RepositoriesModule` export of `SnapshotRepository`, `AppModule` import, pipeline end-to-end                                                                | SnapshotId in → IR out → event fired. C1+C2 interfaces compose                                  |
| **C4** | Manifest computation/hashing, `analysis.repository.findLatestByRepo(repoId)`, incremental path in `StaticAnalysisService`, reuse-ratio metric, threshold config                                                                                                       | Previous IR + new manifest → partial re-parse. Reuses C3 pipeline for full re-parse fallback    |

## Shared Kernel Changes

1. **`DomainEventDispatcher`**: Add `registerHandler(eventType: string, handler: DomainEventHandler): void` to interface. `InMemoryDomainEventDispatcher` stores `Map<eventType, handler[]>`. Existing `dispatch()` routes to matching handlers.

2. **`RepositoriesModule.exports`**: Add `SnapshotRepository`. No new dependencies — `SnapshotRepository` already uses TypeORM internally.

3. **`SharedModule`**: Add `AnalysisEventHandler` provider subscribing to `repository.synchronized` at bootstrap.

4. **`package.json`**: `typescript` moves from devDeps to deps; add `ts-morph`.

## Testing Strategy

| Layer       | Approach                                                                        | Fixture                                               |
| ----------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Domain      | Plain unit tests for VOs, entities, `LanguageDetector`, `IrValidator`           | Inline test data                                      |
| Parser      | Unit tests with synthetic `.ts` strings, real fixture repos in `test/fixtures/` | NestJS controller/service/module fixtures             |
| IR Builder  | Round-trip: parse fixture → build IR → assert structure                         | Each NestJS pattern gets a test case                  |
| Integration | `StaticAnalysisService` with mock `SnapshotRepository` + real parsers           | Snapshot pointing to fixture repo                     |
| E2E         | Full `app` bootstrap with in-memory DB, sync → analysis queue → event           | Small git repo fixture (`test/fixtures/mini-nestjs/`) |
| Incremental | Two snapshots (baseline + modified), compare reuse ratio                        | Two fixture repos (v1 + v2 with one changed file)     |

TDD flow per slice: write test → see it fail → implement → see it pass → refactor.

## Open Questions

- None. All three unresolved decisions resolved above.
