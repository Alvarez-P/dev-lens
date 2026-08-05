# Archive Report — EPIC-005 Static Analysis Engine

**Change:** `epic-005-static-analysis`
**Archived:** 2026-08-04
**Branch:** `feat/static-analysis`
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (6 capability specs)

---

## Completion Summary

| Metric         | Value                                              |
| -------------- | -------------------------------------------------- |
| Status         | **COMPLETED**                                      |
| Tasks          | 28 across 4 slices (C1–C4, chained PRs #1–#4)      |
| Unit tests     | 254 passing (36 suites)                            |
| E2E tests      | 10 passing (3 suites)                              |
| Total tests    | 264 passing (22 test files)                        |
| Build          | ✅ `nest build` exit 0                             |
| Type check     | ✅ `tsc --noEmit` clean                            |
| Lint           | ✅ 0 errors, 0 warnings (`--max-warnings=0`)       |
| Coverage       | ➖ No coverage tool configured (project-level gap) |
| Verify verdict | **PASS WITH WARNINGS**                             |

## Capabilities Delivered

| Domain                      | Spec file (global)                                   |
| --------------------------- | ---------------------------------------------------- |
| language-detection          | `openspec/specs/language-detection/spec.md`          |
| parser-abstraction          | `openspec/specs/parser-abstraction/spec.md`          |
| typescript-parser           | `openspec/specs/typescript-parser/spec.md`           |
| intermediate-representation | `openspec/specs/intermediate-representation/spec.md` |
| static-analysis-pipeline    | `openspec/specs/static-analysis-pipeline/spec.md`    |
| incremental-analysis        | `openspec/specs/incremental-analysis/spec.md`        |

All 40 spec scenarios across the 6 spec files are covered by passing tests.

## Key Decisions (from design.md)

1. **Strategy pattern for parsers** — `ParserRegistry` maps language → `LanguageParser`; `InMemoryParserRegistry` keys by `language.name`, throws `UnknownLanguageError` on miss.
2. **`DecoratorRoleRegistry` (open/closed)** — injectable class with default NestJS mappings + `register(name, role)` for extensibility; new decorators added without touching parser core.
3. **Full re-parse threshold `>50%`** — configurable via `STATIC_ANALYSIS_THRESHOLD` env var (default `0.5`); the tipping point where partial merge overhead exceeds full re-parse cost.
4. **Manifest + IR co-located as JSONB** on the `Analysis` entity (`fileManifest` alongside `ir`) — single query loads both for comparison; JSONB avoids schema migration pain as IR evolves.
5. **Immutable IR value objects** — 10 VOs with `ValueObject` base, private constructors, `Object.freeze` collections, stable `fqn = project:package:module#name`.
6. **Event-driven pipeline** — `repository.synchronized` → registered handler → BullMQ `analysis` queue → `StaticAnalysisService` → persist → `analysis.completed`. `analysis.started/completed/failed` events with snapshotId/repositoryId/workspaceId/correlationId/timestamp.
7. **`DomainEventDispatcher.registerHandler`** — `Map<eventType, handler[]>` routing; existing flat catch-all handler list kept for backward compatibility.
8. **BullMQ reliability** — retry 3× with exponential backoff; final failure copied to `analysis-dlq` dead-letter queue.
9. **Feature-branch chain** — 4 slices (C1–C4), PRs #1–#4 retargeted on `feat/static-analysis`; each slice within ~400-line budget.
10. **Idempotency** — pipeline idempotent by `snapshotId`; skip if COMPLETED + IR non-null; FAILED rows get a fresh attempt.

## Deviations (documented during apply)

1. **Manifest key space = repo-relative paths** (not absolute) — required so manifests compare across clones/checkouts and across `repo-v1`/`repo-v2` e2e fixtures. Changed the C3 inline convention; `SOURCE_EXTENSIONS` + `IGNORED_DIRECTORIES` centralized in `FileManifestService`.
2. **`reuseRatio` stored on entity only** — not included in `analysis.completed` event metadata (spec says SHOULD). Documented as "simple approach" for follow-up if observability requires it.
3. **Handler registration in `AnalysisModule.onModuleInit`** instead of `SharedModule` — deliberate cycle avoidance (design deviation confirmed in verify).
4. **`analyze({snapshotId, repositoryId})`** instead of task's `analyze(snapshotId)` — existing `SnapshotRepository.findById(repositoryId, snapshotId)` requires both IDs; the `repository.synchronized` event carries both.
5. **`Language` extension normalization** (lowercase) — supports case-insensitive detection beyond the literal spec wording.
6. **`ParserRegistry.get(identifier: string)`** keyed by language name — reconciled design's `get(language)` to spec's string-identifier scenarios.
7. **`DecoratorRoleRegistry` extras** beyond spec minimum (`Catch`, `UseGuards`, `Middleware`, `WebSocketGateway`, `EventPattern`, `MessagePattern`) — extensibility defaults, not harmful.
8. **`findLatestByRepo` implemented in C2** (task 4.1 was a stale cross-reference; verified as no-op in C4).
9. **`RepositoriesModule` exports `GitService`** in addition to `SnapshotRepository` — required by `StaticAnalysisService.getRepoPath`.
10. **E2E bootstraps real AnalysisModule graph with mocked external IO** — no Redis/Postgres driver in repo; mocked queues/ORM repos/snapshot+git service; `jest-e2e.json` recreated.
11. **Task count 28** — tasks.md tracks 28 checkboxes across 4 slices; verify-report's "27" excludes the C4 final verify row. Recorded here as 28 per the task ledger.

## Warnings (from verify-report — all non-blocking)

1. **`reuseRatio` not on `analysis.completed` event** — incremental-analysis spec (Reuse Ratio Metric) says "SHOULD be included in event metadata". Currently entity-only. Recommendation: add optional `reuseRatio` to `AnalysisCompletedEvent` in a follow-up. Impact: downstream consumers cannot observe reuse ratio without querying the entity.
2. **`LanguageDetector` does not log warnings for unknown extensions** — spec says "SHALL be skipped with a logged warning". Detector returns `null` (correct skip) but neither detector nor pipeline logs. Recommendation: `Logger.warn` in `detectMany()` or at pipeline level. Impact: silent exclusion without observability.
3. **TDD evidence format (informational)** — apply-progress documents TDD narratively rather than the structured RED/GREEN/TRIANGULATE/SAFETY NET table. All tests exist and pass; retrieval is manual only.

## Suggestions (from verify — for future reference)

- Document `DecoratorRoleRegistry` built-in defaults in the type spec.
- Consider JSDoc only on public API surface (`analyze`) if "no comments" is preferred.
- Optional stronger determinism test: parse → serialize → compare round-trip for ts-morph ASTs.

## Artifacts in This Archive

- `proposal.md` — intent, scope, approach, chained PR strategy, risks, rollback
- `design.md` — architecture decisions, domain model, data flow, per-slice design
- `tasks.md` — 28 tasks across C1–C4 (all `[x]`)
- `apply-progress.md` — per-task TDD evidence, deviations, gotchas
- `verify-report.md` — completeness, test execution, spec compliance matrix, verdict
- `specs/` — 6 delta specs (language-detection, parser-abstraction, typescript-parser, intermediate-representation, static-analysis-pipeline, incremental-analysis)
- `archive-report.md` — this report

## Next Steps

- Address the two open warnings (reuseRatio on event; unknown-extension logging) as a small follow-up change.
- Downstream epics (EPIC-006 graph, EPIC-009 docs, EPIC-010 search, EPIC-011 metrics) can consume the synced `openspec/specs/` capabilities.
