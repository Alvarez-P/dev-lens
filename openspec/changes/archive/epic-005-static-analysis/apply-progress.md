# Apply Progress — EPIC-005 C1 (PR #1)

Branch: `feat/static-analysis` · Strict TDD · Artifact store: openspec

> NOTE: C2 apply uses test filter `pnpm --filter devlens-backend` (package name is `devlens-backend`; the bare `--filter backend` does not match any workspace package).

## 1.1 (D) Language VO — DONE

- Test: `test/unit/modules/analysis/domain/language.vo.spec.ts` — 7 tests passing
- Source: `src/backend/src/modules/analysis/domain/language.vo.ts`
- Notes: `Language.create(name, extension)`; extension lowercased; validates empty name + missing dot prefix. Deviation: spec says "name string + extension string" — kept extension normalization (lowercase) to support case-insensitive detection (spec language-detection).

## 1.2 (D) ParsedFile + ParseResult + Diagnostic — DONE

- Test: `test/unit/modules/analysis/domain/parse-result.vo.spec.ts` — 9 tests passing
- Source: `parsed-file.vo.ts`, `parse-result.vo.ts`
- Notes: Diagnostic has severity enum (error/warning/info), message, line. ParseResult.success()/failure() factories; `isSuccess` getter = ast non-null && no diagnostics.

## 1.3 (D) LanguageParser + ParserRegistry interfaces — DONE

- Test: `test/unit/modules/analysis/domain/interfaces.spec.ts` — 3 tests passing
- Source: `interfaces/language-parser.interface.ts`, `interfaces/parser-registry.interface.ts`
- Notes: Contract tests. Deviation: spec uses string identifiers (`registry.get('go')`) so `get(identifier: string)` per parser-abstraction spec scenarios; design.md shows `get(language)` — reconciled to string lookup keyed by language name.

## 1.4 (K) DomainEventDispatcher.registerHandler — DONE

- Test: `test/unit/shared/domain/domain-event-dispatcher.spec.ts` — 4 tests passing (new file)
- Source: `shared/domain/domain-event-dispatcher.ts`
- Notes: Interface extended with `registerHandler(eventType, handler)`. Impl stores `Map<eventType, handler[]>`, dispatch routes by eventType; constructor's flat handler list kept as catch-all for backward compat. `InMemoryUnitOfWork` needed no changes (only uses dispatch/dispatchBatch). tsc clean.

## 1.5 (D) Analysis events — DONE

- Test: `test/unit/modules/analysis/domain/analysis-events.spec.ts` — 3 tests passing
- Source: `analysis-events.ts`
- Notes: AnalysisStarted/Completed/Failed events; positional constructors per codebase convention; each carries snapshotId, repositoryId, workspaceId, correlationId, timestamp (per pipeline spec); aggregateId = snapshotId (or analysisId for completed).

## 1.6 (D) LanguageDetector — DONE

- Test: `test/unit/modules/analysis/domain/language-detector.service.spec.ts` — 10 tests passing
- Source: `services/language-detector.service.ts`
- Notes: detect() → Language|null (null for unknown, no throw); detectMany() → Map<Language, string[]> per language-detection spec. Gotcha: Map keyed by Language VO uses reference equality — grouped internally by `language.name` string first to avoid duplicate keys, then rebuilt as Map<Language, string[]>.

## 1.7 (I) InMemoryParserRegistry — DONE

- Test: `test/unit/modules/analysis/infrastructure/parser-registry.spec.ts` — 4 tests passing
- Source: `parsers/parser-registry.ts`, plus new `domain/analysis-errors.ts` (UnknownLanguageError, DomainError, code UNKNOWN_LANGUAGE, 404)
- Notes: register() keys by language.name; get(identifier) throws UnknownLanguageError.

## 1.8 (I) DecoratorRoleRegistry — DONE

- Test: `test/unit/modules/analysis/infrastructure/decorator-role-registry.spec.ts` — 8 tests passing
- Source: `parsers/decorator-role-registry.ts`
- Notes: Default NestJS mappings (Module/Controller/Injectable/EntityRepository/etc.); register() for extensibility + override; getRole() alias.

## 1.9 (I) TypeScriptParser + ts-morph — DONE

- Deps: `ts-morph@^28.0.0` added to deps; `typescript@^5.9.3` moved devDeps→deps (package.json + lockfile)
- Test: `test/unit/modules/analysis/infrastructure/typescript-parser.spec.ts` — 12 tests passing
- Source: `parsers/typescript/typescript-parser.ts`
- Notes: Uses ts-morph Project with in-memory FS; syntactic diagnostics via `program.getSyntacticDiagnostics(compilerNode)` — preEmitDiagnostics pulls in noisy module-resolution errors, so syntactic-only is used (per spec "syntax errors SHALL return diagnostics"). Decorator classification: Controller→controller (+routePrefix), Injectable→service/guard/interceptor/pipe (via implements), Module→module, unrecognized ignored. metadata.decoratorRoles = [{className, role, routePrefix?}]. Deterministic.

## 1.10 Barrel — DONE

- Test: `test/unit/modules/analysis/domain/index.spec.ts` — 6 tests passing
- Source: `domain/index.ts` (all VOs, interfaces, events, errors, services) + `modules/analysis/index.ts` (module root barrel incl. infra)

## Final Verification — DONE

- `pnpm test` (backend): 23 suites / 147 tests pass
- `pnpm --filter devlens-backend build`: exit 0 (dist/src/main.js)
- `pnpm exec tsc --noEmit`: clean
- Lint (analysis + modified shared files): 0 errors; 1 pre-existing warning (unused `Identifier` import in unit-of-work.ts — untouched)
- `pnpm -r test` / `pnpm -r build` at workspace root: frontend fails on pre-existing GLIBC_2.32/rollup env issue, unrelated to this slice

## 2.1 (D) IR value objects — DONE

- Test: `test/unit/modules/analysis/domain/ir-nodes.spec.ts` — 20 tests passing
- Source: `src/modules/analysis/domain/ir-nodes.ts`
- Notes: 10 VOs (IrProject/IrPackage/IrModule/IrClass/IrInterface/IrFunction/IrMethod/IrEndpoint/IrDependency/IrRelationship), all extend ValueObject, private constructors + static factories, fqn = `project:package:module#name` composed down the tree. IrProject also carries `dependencies` + `relationships` (edges). Factories enforce field-level invariants (throw on empty); cross-node rules (≥1 package, ≥1 module, uniqueness) are left to the IrValidator so batch error collection stays testable. `Object.freeze` on every collection + derived edge fqns. `toJSON()` on every node for JSONB round-trip (language serialized as `{name, extension}`). Deviation: TS forbids `extends`/`implements` as constructor parameter properties (reserved words) — IrClass uses explicit field declarations; property names remain `extends`/`implements`.

## 2.2 (D) IrValidator service — DONE

- Test: `test/unit/modules/analysis/domain/ir-validator.service.spec.ts` — 14 tests passing
- Source: `src/modules/analysis/domain/services/ir-validator.service.ts`
- Notes: 4 batch checks (structural incl. ≥1 package / ≥1 module per spec Required check, relationship integrity, identifier uniqueness, referential incl. dependency source+target and class extends/implements). `ValidationResult` VO in same file. External-reference heuristic: a reference containing `:` is treated as an IR-internal fqn and must exist; bare targets (`@nestjs/common`, `BaseController`) are external and skipped. Gotcha: uniqueness check must iterate the raw node list — building a `Set` first silently collapses duplicates, which would hide the very errors it exists to catch (caught by TDD RED run).

## 2.3 (I) TypeScriptIrBuilder — DONE

- Test: `test/unit/modules/analysis/infrastructure/typescript-ir-builder.spec.ts` — 15 tests passing
- Source: `src/modules/analysis/infrastructure/parsers/typescript/typescript-ir-builder.ts`
- Notes: `build(parseResults, {projectName, rootPath}) → {ir, diagnostics}`. Reads the ts-morph SourceFile AST directly; class roles + controller routePrefix come from parser metadata (`metadata.decoratorRoles`) with a registry-scan fallback when metadata is absent. Single `default` package; module name = rootPath-relative path minus source extension. HTTP decorators (Get/Post/Put/Delete/Patch/Options/Head/All) → endpoints with `routePrefix + methodPath` paths. Imports → dependencies: relative specifiers resolved across parsed modules (module-to-module edge); external specifiers kept raw. Same-module `extends`/`implements` resolved to fqns + emitted as relationships; unresolved targets stay raw (validator treats non-`:`-containing values as external). Failed ParseResults skipped + reported in diagnostics. Deterministic (Map/array order preserved; modules deduped by filePath, deps deduped by source|target|type). Gotchas: (1) ts-morph 28 has no `getVisibility()` — uses `hasModifier('private'|'protected')`; (2) module path normalization must strip only known source extensions (`/\.[^.]+$/` mangles dotted names like `users.service` — caught by RED run).

## 2.4 (D) Analysis entity + supporting types — DONE

- Test: `test/unit/modules/analysis/domain/analysis.entity.spec.ts` — 8 tests passing
- Source: `analysis-id.vo.ts` (Identifier<string>, create/from like SnapshotId), `analysis-status.enum.ts` (PENDING|PROCESSING|COMPLETED|FAILED, uppercase per SnapshotStatus convention), `analysis.entity.ts` (AggregateRoot<AnalysisId>)
- Notes: `create(snapshotId, repositoryId)` → PENDING/ir null/manifest null; `startProcessing(workspaceId, correlationId)`; `completeProcessing(ir, manifest, workspaceId, correlationId)`; `failProcessing(error, workspaceId, correlationId)`. Transition methods take workspaceId+correlationId because the aggregate does not store them (they ride the emitted domain events). State guards: start only from PENDING, complete only from PROCESSING, fail only from PENDING/PROCESSING. `reconstitute()` for persistence. `analysis-errors.ts` extended with `InvalidIrError` (422) and `AnalysisNotFoundError` (404).

## 2.5 (I) Analysis persistence — DONE

- Test: `test/unit/modules/analysis/infrastructure/analysis.repository.spec.ts` — 5 tests passing (mock TypeORM via `getRepositoryToken`)
- Source: `persistence/typeorm/analysis.typeorm-entity.ts`, `persistence/repositories/analysis.repository.ts`
- Notes: `@Entity('analysis')` with `snapshot_id`, `repository_id`, `status` (string, default PENDING), `ir` jsonb nullable, `file_manifest` jsonb nullable, `created_at`/`updated_at`; `@Index(['repositoryId'])` for findLatestByRepo. Repository: `save(analysis)`, `findById(AnalysisId)`, `findLatestByRepo(RepositoryId)` (order createdAt DESC). Round-trip: `ir` persisted via `IrProject.toJSON()` (language as `{name, extension}`), deserialized via `Language.create` + `IrProject.create`. `findLatestByRepo` implemented now per C2 task spec (C4 task 4.1 lists the same method — likely a stale cross-ref; no-op there). `IrProjectJson` added to domain barrel.

## Final Verification — DONE

- `pnpm --filter devlens-backend test`: 28 suites / 209 tests pass (baseline C1 was 23/147 → +5 suites / +62 tests; all 5 new C2 suites green)
- `pnpm --filter devlens-backend exec tsc --noEmit`: clean
- `pnpm --filter devlens-backend build`: exit 0
- Lint (analysis src + tests): 0 errors; 4 pre-existing warnings in C1's untouched `interfaces.spec.ts`
- Note: tasks.md used `--filter backend` which does not match the workspace package (`devlens-backend`); actual commands use `pnpm --filter devlens-backend`

## 3.1 (K) RepositoriesModule exports — DONE

- Source: `src/backend/src/modules/repositories/repositories.module.ts`
- Added `SnapshotRepository` AND `GitService` to `exports` (GitService is required by StaticAnalysisService for `getRepoPath`; not exported before — needed beyond the literal one-line task spec).
- No test (wiring-only); verified via tsc + AnalysisModule spec + e2e DI resolution.

## 3.2 (A) StaticAnalysisService — DONE

- Test: `test/unit/modules/analysis/application/static-analysis.service.spec.ts` — 7 tests passing
- Source: `src/modules/analysis/application/static-analysis.service.ts`
- Notes: `analyze({snapshotId, repositoryId})` — deviation from task's `analyze(snapshotId)` because `SnapshotRepository.findById(repositoryId, snapshotId)` requires BOTH ids (existing EPIC-004 API); the `repository.synchronized` event carries both so the job payload carries both. Idempotency via new `AnalysisRepository.findBySnapshotId` (added method + 2 repo tests): skip if COMPLETED + ir non-null; FAILED rows get a fresh attempt (aggregate transitions are PENDING-only). Pipeline: load snapshot → `GitService.getRepoPath` → recursive `fs.readdirSync` walk (skips .git/node_modules/dist/build/coverage/.next/.nuxt/out) → `LanguageDetector.detectMany` → parse per language → `TypeScriptIrBuilder.build(projectName=snapshotId, rootPath=repoPath)` → `IrValidator.validate` → throw `InvalidIrError` on invalid (never persists invalid IR) → `completeProcessing` → save → `dispatchBatch`. Errors: transition PENDING/PROCESSING→FAILED, save, dispatch `analysis.failed`, rethrow (BullMQ retries). `analysis.started` fires first (startProcessing right after idempotency check) so event order is always started→completed/failed with one correlationId. Minimal SHA-256 fileManifest computed inline (C4 extracts to FileManifestService per 4.2). Gotcha: Node ≥20.1 `readdirSync(recursive, withFileTypes)` returns Dirent with BASENAME in `.name` and the parent dir in `.parentPath` — paths reconstructed via `join(entry.parentPath, entry.name)` and ignored-dir filtering must inspect full path segments (caught by RED run reading `/tmp/.../dep.ts`).

## 3.3 (I) AnalysisJobProcessor — DONE

- Test: `test/unit/modules/analysis/infrastructure/analysis.job-processor.spec.ts` — 3 tests passing
- Source: `src/modules/analysis/infrastructure/jobs/analysis.job-processor.ts`
- Notes: `@Processor('analysis')` WorkerHost; `process(job)` delegates to service with `{snapshotId, repositoryId}`; rethrows so BullMQ retries (attempts=3, exponential backoff 1000ms set at enqueue time by the handler). DLQ: injects `@InjectQueue('analysis-dlq')`; on final attempt (`attemptsMade >= opts.attempts - 1`) copies job data to DLQ as `analysis-failed` with `jobId` preserved.

## 3.4 (I) AnalysisEventHandler — DONE

- Test: `test/unit/modules/analysis/infrastructure/analysis-event-handler.spec.ts` — 3 tests passing
- Source: `src/modules/analysis/infrastructure/events/analysis-event-handler.ts`
- Notes: Option A (design-preferred): handler registered via `DomainEventDispatcher.registerHandler('repository.synchronized', ...)` in `AnalysisModule.onModuleInit`. `handle(event)` enqueues `queue.add('analyze', {snapshotId, repositoryId}, {attempts:3, backoff:{type:'exponential',delay:1000}, removeOnComplete:1000, removeOnFail:5000})`; ignores non-synchronized events. Queue names centralized in `src/modules/analysis/analysis.tokens.ts` (ANALYSIS_QUEUE, ANALYSIS_DLQ, PARSER_REGISTRY) to avoid module↔infra circular imports.

## 3.5 (I) AnalysisModule — DONE

- Test: `test/unit/modules/analysis/analysis.module.spec.ts` — 4 tests passing
- Source: `src/modules/analysis/analysis.module.ts`
- Notes: imports `TypeOrmModule.forFeature([AnalysisTypeOrmEntity])`, `BullModule.registerQueue(analysis, analysis-dlq)`, `RepositoriesModule`. Providers: StaticAnalysisService, AnalysisRepository, AnalysisJobProcessor, AnalysisEventHandler, LanguageDetector, IrValidator, DecoratorRoleRegistry, TypeScriptParser, TypeScriptIrBuilder + `PARSER_REGISTRY` factory registering TypeScriptParser for 'typescript' AND 'javascript' (detector maps .js/.jsx → javascript; ts-morph parses both). Exports `[StaticAnalysisService]`. `onModuleInit` registers the synchronized handler. Gotchas: (1) classes first used via DI needed `@Injectable()` added — TypeScriptParser, TypeScriptIrBuilder, DecoratorRoleRegistry, LanguageDetector, IrValidator, InMemoryParserRegistry (previously only instantiated directly in tests; Nest silently passed `undefined` deps without the decorator — caught by e2e RED); (2) module spec must NOT call `moduleRef.init()` — BullMQ's explorer scans `@Processor` providers and creates real Workers needing Redis; invoke `AnalysisModule.onModuleInit()` manually instead; (3) `DOMAIN_EVENT_DISPATCHER` override is a no-op unless SharedModule is imported (parent providers don't flow down), so tests import `NestConfigModule.forRoot` + real `SharedModule` and read the dispatcher via `moduleRef.get('DOMAIN_EVENT_DISPATCHER')`; (4) all `getRepositoryToken(...)` for analysis + repositories entities must be overridden — `forFeature` eagerly instantiates ORM repo providers that need a DataSource.

## 3.6 (K) AppModule + barrel — DONE

- `src/backend/src/app.module.ts`: imported `AnalysisModule` (BullModule.forRoot already present — Redis connection from ConfigService, no change needed).
- `src/modules/analysis/index.ts` barrel: exports StaticAnalysisService/AnalysisJobData, AnalysisJobProcessor, AnalysisEventHandler, ANALYSIS_QUEUE/ANALYSIS_DLQ/PARSER_REGISTRY tokens.
- Verify: `pnpm --filter devlens-backend exec tsc --noEmit` clean, `nest build` exit 0.

## 3.7 (I) OnModuleInit handler registration — DONE

- Folded into 3.5 (AnalysisModule.onModuleInit) per design.md "SharedModule cycle" avoidance — handler lives in AnalysisModule, not SharedModule. Verified by module spec + e2e (dispatch `RepositorySynchronizedEvent` → queue.add called).

## 3.8 (E2E) Pipeline e2e — DONE

- Test: `test/e2e/analysis/analysis.e2e-spec.ts` — 3 tests passing (also runs in unit suite per repo convention)
- Fixture: `test/fixtures/mini-nestjs/` — 8 files: app.module/controller/service, users module/controller/service (controller + injectable + interface), shared/logger (functions), main.
- Recreated `test/backend/test/jest-e2e.json` (was missing): rootDir `..`, testRegex `e2e/.*\.(e2e-)?spec\.ts$`.
- `jest.config.js` testRegex updated to `.*\.(e2e-)?spec\.ts$` so `*.e2e-spec.ts` matches (both `.spec.ts` and `.e2e-spec.ts` end differently; oauth uses `.integration.spec.ts` which already matched).
- Notes: no Redis/Postgres/sqlite driver in this repo, so e2e bootstraps the real AnalysisModule graph (real parser/builder/validator/service/dispatcher) with mocked external IO: in-memory AnalysisRepository, mocked SnapshotRepository + GitService (returns real fixture path on disk), mocked queues, ORM repo tokens overridden. Covers: event→enqueue, full pipeline→COMPLETED IR with controller roles + endpoints (`GET /users/:id`), manifest hashes ≥8 files, started→completed same correlationId; syntax-error temp repo → FAILED + no IR + started→failed. `pnpm test:e2e`: 2 suites / 9 tests pass.

## C3 Final Verification — DONE

- `pnpm --filter devlens-backend test`: 33 suites / 231 tests pass (baseline C2 was 28/209 → +5 suites / +22 tests)
- `pnpm --filter devlens-backend exec tsc --noEmit`: clean
- `pnpm --filter devlens-backend build`: exit 0
- `pnpm --filter devlens-backend test:e2e`: 2 suites / 9 tests pass
- Lint (analysis src + tests + app.module + repositories.module + fixtures): 0 errors; only pre-existing warnings (C1's interfaces.spec.ts unused args)

## 4.1 (I) findLatestByRepo — DONE (no-op, verified)

- `findLatestByRepo` already implemented in C2 task 2.5 (`analysis.repository.ts` line 38): queries by `repositoryId` ordered by `created_at` DESC via `findOne` (limit 1 inherent).
- Test coverage already exists: `test/unit/modules/analysis/infrastructure/analysis.repository.spec.ts` `findLatestByRepo` describe block (2 tests). C4 cross-ref confirmed stale, per C2 note.
- No code change in this slice; `@Index(['repositoryId'])` on the TypeORM entity supports it.

## 4.2 (A) FileManifestService — DONE

- Test: `test/unit/modules/analysis/application/file-manifest.service.spec.ts` — 12 tests passing
- Source: `src/backend/src/modules/analysis/application/file-manifest.service.ts`
- Notes: `computeManifest(repoPath, extensions=SOURCE_EXTENSIONS)` walks the repo (skipping the shared IGNORED_DIRECTORIES) and returns `Record<repoRelativePath, sha256>`; `diffManifests` classifies added/modified/deleted/unchanged; `shouldFullReparse(diff, totalFiles, threshold=0.5)` returns `changed/total > threshold`, with `totalFiles <= 0` forcing full. **DEVIATION (manifest key space):** manifests are keyed by repo-RELATIVE paths, not absolute — required so manifests stay comparable across clones/checkouts (and across the repo-v1/repo-v2 e2e fixtures which live in different dirs). This changes the C3 inline manifest convention (was absolute); C3 service-spec assertion updated to the array form `toHaveProperty(['src/users.controller.ts'])` (jest splits string keys on `.`). SOURCE_EXTENSIONS + IGNORED_DIRECTORIES exported from this service; StaticAnalysisService now imports IGNORED_DIRECTORIES (single source of truth, its local copy removed).

## 4.3 (K) STATIC_ANALYSIS_THRESHOLD — DONE

- `src/backend/src/config/configuration.ts`: `AnalysisConfig { staticAnalysisThreshold }` added to `AppConfiguration`, loaded from `process.env.STATIC_ANALYSIS_THRESHOLD || '0.5'` (parseFloat).
- `src/backend/src/config/config.service.ts`: `get analysis()` getter (follows GitService's custom ConfigService pattern).
- `.env.example`: documented `STATIC_ANALYSIS_THRESHOLD=0.5` under a new Static Analysis section.
- Test: `test/unit/configuration.spec.ts` — 3 new tests (default 0.5, env override 0.8, shape). Suite: 9 tests passing.
- Wired: `AnalysisModule` now imports the custom `ConfigModule`; `StaticAnalysisService` injects the custom `ConfigService`.

## 4.4 (A) StaticAnalysisService incremental — DONE

- Tests: `test/unit/modules/analysis/application/static-analysis.service.incremental.spec.ts` — 5 tests passing (no previous → full; >50% changed → full fallback; <50% → partial + reuseRatio=2/3; deleted file dropped from merged IR; added file merged into IR).
- Source: `src/backend/src/modules/analysis/application/static-analysis.service.ts` — `analyze()` now: loads previous via `findLatestByRepo`, computes manifest via `FileManifestService`, then `buildIr()` decides full vs partial. Full path unchanged in behavior (walk → detectMany → parse → build with `projectName=snapshotId`). Partial path: detects+parses ONLY `diff.added + diff.modified`, builds a partial IR with `projectName = previousIr.name` (keeps fqns stable across snapshots), then `mergeIr()`.
- `mergeIr` strategy (per design): keep previous modules whose repo-relative path is in `diff.unchanged` (re-based to the current clone root so module paths stay internally consistent and fqn stays stable since fqn derives from module NAME); replace with freshly built modules for added/modified files; recompute flat edges — keep previous dependencies/relationships whose source module is unchanged, add partial edges (relative specifiers resolved against the merged path→fqn map so changed→unchanged imports keep resolved targets); dedupe by source|target|type. Deleted files referenced by unchanged modules surface as dangling fqns — validator catches them (documented v1 scope, per architecture notes).
- `reuseRatio = diff.unchanged.length / totalFiles` on partial runs; stored on the aggregate via new nullable `reuseRatio` field (null on full runs). `Analysis.entity` + `AnalysisTypeOrmEntity` (`reuse_ratio` real, nullable) + repository round-trip updated. `completeProcessing` gained optional 5th param `reuseRatio = null` (existing call sites unaffected).
- DEVIATION: reuseRatio is stored on the entity only — the spec says it SHOULD also ride `analysis.completed` event metadata; task 4.4 chose the entity ("simple approach") and the event has no metadata field, so the event is unchanged (documented for a follow-up if observability requires it).
- Gotcha (from RED runs): jest `toHaveProperty` splits STRING keys on `.`, so manifest-key assertions must use the array form `toHaveProperty(['src/app.ts'])` (matches C3's original absolute-path array form).

## 4.5 (E2E) Incremental e2e + fixtures — DONE

- Test: `test/e2e/analysis/incremental.e2e-spec.ts` — 1 test passing (also runs in the unit suite per repo convention).
- Fixtures: `test/fixtures/repo-v1/src/` + `test/fixtures/repo-v2/src/` — 3 files each (app.module/controller/service); only `app.service.ts` differs (v2 adds `getVersion()`).
- Scenario: analyze snapshot-1 (repo-v1, full, reuseRatio null, parser called 3×) → analyze snapshot-2 (repo-v2) → parser called exactly 1× with the repo-v2 `src/app.service.ts` path, `reuseRatio ≈ 2/3`, merged IR has all 3 modules, service module contains the new `getVersion` method, manifest has 3 files.
- Mechanism: real parser/builder/validator/service graph (mocked external IO like the C3 e2e), parser spy via `moduleRef.get(PARSER_REGISTRY).get('typescript')`, `InMemoryAnalysisRepository` (shared by both e2e specs) gained `findLatestByRepo`; snapshot mocks keyed by snapshotId; `gitService.getRepoPath` switched to repo-v2 between runs.

## C4 Final Verification — DONE

- `pnpm --filter devlens-backend test`: 36 suites / 254 tests pass (baseline C3 was 33/231 → +3 suites / +23 tests)
- `pnpm --filter devlens-backend exec tsc --noEmit`: clean
- `pnpm --filter devlens-backend build`: exit 0
- `pnpm --filter devlens-backend test:e2e` (`jest --config ./test/jest-e2e.json`): 3 suites / 10 tests pass (was 2/9 → +1 suite / +1 test)
- Lint (analysis src + config + tests + e2e): 0 errors; only pre-existing warnings (C1's interfaces.spec.ts unused args)
- Note: `pnpm test:e2e` script passes `--` before extra args, so `--testPathPattern` filters don't apply through the script; filter with `pnpm --filter devlens-backend exec jest --config ./test/jest-e2e.json <pattern>`.
