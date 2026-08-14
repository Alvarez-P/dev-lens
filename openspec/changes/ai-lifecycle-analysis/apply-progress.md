# Apply Progress: AI Lifecycle Analysis (ai-lifecycle-analysis)

**Change**: ai-lifecycle-analysis
**Slice**: Phase 1 — Manifest Candidate Foundation (`analysis` module) — PR 1 of feature-branch-chain (targets `feat/ai-lifecycle-analysis`)
**Mode**: Strict TDD (openspec `testing.strict_tdd: true`)
**Chain strategy**: feature-branch-chain
**Branch**: `feat/ai-lifecycle-pr1-manifest-foundation`

## Scope (this slice)

Tasks 1.1–1.7 ONLY. Phase 2/3/4 are separate PRs — NOT implemented here.

## TDD Cycle Evidence

| Task | Test File                                                                                                   | Layer | Safety Net        | RED                                                          | GREEN           | TRIANGULATE                                                                            | REFACTOR                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----- | ----------------- | ------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1.1  | `src/backend/test/unit/modules/analysis/domain/framework-candidate.vo.spec.ts`                              | Unit  | N/A (new)         | ✅ Written (TS2307 module missing)                           | ✅ Passed 7/7   | ✅ 4 cases: valid/blank-framework/blank-file/empty-markers                             | ✅ Clean (frozen VO, defensive copy)                       |
| 1.2  | (same file as 1.1)                                                                                          | Unit  | N/A (new)         | — (GREEN task; code written to satisfy 1.1 RED)              | ✅ Passed 7/7   | ✅ via 1.1 cases                                                                       | ✅ Clean                                                   |
| 1.3  | `src/backend/test/unit/modules/analysis/application/manifest-framework-detector.spec.ts`                    | Unit  | N/A (new)         | ✅ Written (TS2307 module missing)                           | ✅ Passed 6/6   | ✅ 6 cases: nestjs/express/no-manifest/no-match/devDeps/invalid-JSON                   | ✅ Clean (marker map constant extracted)                   |
| 1.4  | (same file as 1.3)                                                                                          | Unit  | N/A (new)         | — (GREEN task; code written to satisfy 1.3 RED)              | ✅ Passed 6/6   | ✅ via 1.3 cases                                                                       | ✅ Clean (`PACKAGE_JSON_FRAMEWORK_MARKERS` ADR-2 constant) |
| 1.5  | `src/backend/test/unit/modules/analysis/domain/analysis.entity.spec.ts`                                     | Unit  | ✅ 13/13 baseline | ✅ Written (TS2339 field missing, TS2554 reconstitute arity) | ✅ Passed 13/13 | ✅ 3 cases: create=null/completeProcessing stores/default null + reconstitute restores | ✅ Clean (additive param default null)                     |
| 1.6  | `src/backend/test/unit/modules/analysis/infrastructure/analysis.repository.spec.ts`                         | Unit  | ✅ 7/7 baseline   | ✅ Written (TS2353 column missing)                           | ✅ Passed 10/10 | ✅ 3 cases: save→JSON/null→null/findById→VO                                            | ✅ Clean (`FrameworkCandidateJson` interface)              |
| 1.7  | `src/backend/test/unit/modules/analysis/application/static-analysis.service.spec.ts` (+incremental.spec.ts) | Unit  | ✅ 9/9 baseline   | ✅ Written (TS2554 constructor arity)                        | ✅ Passed 9/9   | ✅ 2 cases: manifest→candidates persisted / no manifest→[]                             | ✅ Clean (detector injected after configService)           |

## Safety Net Baseline (pre-change)

- `npx jest --testPathPattern=analysis`: 24 suites, **202/202 passing**
- Post-change: 26 suites, **223/223 passing** (+21 new tests)
- `npx tsc --noEmit -p src/backend/tsconfig.json`: **clean (exit 0)**

## Commits (work units)

| Commit    | Message                                                           | Files                                                          |
| --------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `15e8925` | `feat(analysis): add framework candidate value object`            | framework-candidate.vo.ts + spec                               |
| `c4228d9` | `feat(analysis): add manifest framework detector`                 | manifest-framework-detector.ts + spec                          |
| `f913e57` | `feat(analysis): persist framework candidates on analysis entity` | analysis.entity.ts, domain/index.ts + entity spec              |
| `086d137` | `feat(analysis): persist framework candidates via jsonb column`   | analysis.typeorm-entity.ts, analysis.repository.ts + repo spec |
| `39f4158` | `feat(analysis): run framework detector during static analysis`   | static-analysis.service.ts, analysis.module.ts + specs         |

## Verification (PR1 boundary)

- ✅ All Phase 1 tests green: 26 analysis suites, 223/223
- ✅ Typecheck: `npx tsc --noEmit -p src/backend/tsconfig.json` exit 0
- ✅ Pre-commit hooks (prettier + eslint --fix) pass on all commits
- ✅ Rollback boundary honored: Phase 1 completed cleanly; no half-committed state

## Deviations from Design

None — implementation matches design.md (module layout, ADR-1/ADR-2, jsonb additive nullable, detector after IR build).

## Notes

- `reconstitute()` and `completeProcessing()` gained an optional trailing `frameworkCandidates` param (default `null`) — additive, keeps all existing callers/tests compiling.
- The incremental spec was updated to inject the new detector dependency (compile-only fix, no behavior change).
- Openspec artifacts (`openspec/changes/ai-lifecycle-analysis/*`) are untracked — intentionally not committed with source code.
