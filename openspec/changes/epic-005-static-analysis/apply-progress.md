# Apply Progress — EPIC-005 C1 (PR #1)

Branch: `feat/static-analysis` · Strict TDD · Artifact store: openspec

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
