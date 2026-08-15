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

---

# Apply Progress — PR 2: Capability Registration + Enrichment (`ai` module)

**Change**: ai-lifecycle-analysis
**Slice**: Phase 2 — Capability Registration + Enrichment (`ai` module) — PR 2 of feature-branch-chain (targets `feat/ai-lifecycle-analysis`)
**Mode**: Strict TDD (openspec `testing.strict_tdd: true`)
**Chain strategy**: feature-branch-chain
**Branch**: `feat/ai-lifecycle-pr2-enrichment`
**Base**: `feat/ai-lifecycle-analysis` @ `342392f` (includes merged PR 1 via #42)

## Scope (this slice)

Tasks 2.1–2.6 ONLY. Phase 3 (golden/tripwire fixtures) and Phase 4 (eval harness) are separate PRs — NOT implemented here.

## TDD Cycle Evidence

| Task | Test File                                                                     | Layer       | Safety Net               | RED                                                                | GREEN                                          | TRIANGULATE                                                                                                                         | REFACTOR                                                     |
| ---- | ----------------------------------------------------------------------------- | ----------- | ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 2.1  | `src/backend/test/unit/modules/ai/application/real-template-files.spec.ts`    | Unit        | ✅ ai baseline 384/384   | — (GREEN task)                                                     | ✅ Passed (v1 examples.json loads)             | ✅ 3 cases: nestjs/express/unknown few-shots + every output aligned to `LifecycleEnrichmentDto` shape                               | ✅ Clean (typed cast of loaded examples)                     |
| 2.2  | `src/backend/test/unit/modules/ai/ai.module.spec.ts`                          | Unit        | ✅ ai baseline 384/384   | — (GREEN task)                                                     | ✅ Passed (capability discoverable at startup) | ✅ 1 case: version 1, enabled, outputFormat json, dto = `LifecycleEnrichmentDto`                                                    | ✅ Clean (asserts via `CAPABILITY_REGISTRY` token)           |
| 2.3  | `src/backend/test/unit/modules/ai/application/enrichment.service.spec.ts`     | Unit        | ✅ ai baseline 384/384   | ✅ Written (TS2304 `detectFrameworkCandidates` missing until impl) | ✅ Passed 392/392 suite                        | ✅ 4 cases: single→primary / none or null→`unknown`+`[]` / ambiguous→generic / run() flows candidates into builder+provider         | ✅ Clean (`FrameworkCandidateResult` shape)                  |
| 2.4  | (same file as 2.3) + `enrichment.service.ts`                                  | Unit        | ✅ ai baseline 384/384   | — (GREEN task; code written to satisfy 2.3 RED)                    | ✅ Passed                                      | ✅ via 2.3 cases                                                                                                                    | ✅ Clean (`detectFramework(ir)` retained as fallback, ADR-3) |
| 2.5  | `src/backend/test/unit/modules/ai/application/prompt-builder.service.spec.ts` | Unit        | ✅ ai baseline 384/384   | — (GREEN task)                                                     | ✅ Passed                                      | ✅ 2 cases: candidates injected as `{{framework_candidates}}` / no-guessing instruction when empty                                  | ✅ Clean (`renderFrameworkCandidates` pure helper extracted) |
| 2.6  | `src/backend/test/e2e/ai/enrichment-pipeline.integration.spec.ts`             | Integration | ✅ e2e/ai baseline 13/13 | — (GREEN task)                                                     | ✅ Passed 15/15 e2e                            | ✅ 2 cases: candidates flow → prompt → 3 gates → `IrEnrichment` persist / schema-fail×2 → never persisted + `EnrichmentFailedEvent` | ✅ Clean                                                     |

## Safety Net Baseline (pre/post)

- Pre-change (`342392f` — tracker base incl. merged PR 1):
  - `npx jest --testPathPattern=modules/ai`: 41 suites, **384/384** passing
  - `npx jest --config test/jest-e2e.json --testPathPattern=e2e/ai`: 3 suites, **13/13** passing
  - `npx tsc --noEmit -p src/backend/tsconfig.json`: **clean (exit 0)**
- Post-change (`efd3e11`):
  - `npx jest --testPathPattern=modules/ai`: 41 suites, **392/392** passing (+8 new tests)
  - `npx jest --config test/jest-e2e.json --testPathPattern=e2e/ai`: 3 suites, **15/15** passing (+2 new tests)
  - `npx tsc --noEmit -p src/backend/tsconfig.json`: **clean (exit 0)**

## Commits (work units)

| Commit    | Message                                                                         | Files                                                                                             |
| --------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `8f2fd0b` | `feat(ai): add classify-lifecycle v1 few-shot examples`                         | ai.capabilities/classify-lifecycle/v1/examples.json + real-template-files.spec.ts                 |
| `69db970` | `feat(ai): register classify-lifecycle capability at startup`                   | ai.module.ts + ai.module.spec.ts                                                                  |
| `1fa2079` | `feat(ai): detect framework candidates from analysis manifest (ADR-3)`          | enrichment.service.ts, prompt-builder.service.ts + enrichment.service.spec.ts                     |
| `d4f0854` | `feat(ai): inject manifest framework candidates into prompts`                   | classify-lifecycle/v1/instructions.md, prompt-builder.service.ts + prompt-builder.service.spec.ts |
| `efd3e11` | `test(ai): integration-verify manifest candidates and unvalidated-output guard` | test/e2e/ai/enrichment-pipeline.integration.spec.ts                                               |

## Verification (PR2 boundary)

- ✅ All Phase 2 tests green: 41 ai unit suites 392/392; e2e/ai 15/15 (incl. `enrichment-pipeline.integration.spec.ts`)
- ✅ Typecheck: `npx tsc --noEmit -p src/backend/tsconfig.json` exit 0
- ✅ Pre-change baseline re-measured from `342392f` in a throwaway git worktree (working tree untouched, no branch re-creation)
- ✅ Boundary honored: only Phase 2 files changed; Phase 3/4 files NOT created; `analysis` module untouched by this slice

## Deviations from Design

None material. `detectFramework(ir)` (IR decorator/import scan) is retained as an exported deterministic fallback (ADR-3: "decorator/import scan stays fallback") but has no call sites in this slice — the pipeline uses `detectFrameworkCandidates` only. No behavior regression (all tests green); wiring the IR scan into the per-unit fallback path is out of scope for Phase 2.

## Notes

- Pre-change numbers measured from the `342392f` tree via `git worktree add` + node_modules symlink — no checkout/rebase of the working branch was needed.
- `detectFrameworkCandidates` returns `{ candidates, primary }`: single distinct framework → `primary` = that framework; multiple → `unknown` (generic config, ADR-3); none/null → `unknown` + `[]` (spec scenario "No manifest yields unknown framework" — never guessed).
- Phase 2 adds no new suite files — all tests were added to existing spec files (enrichment.service, prompt-builder, real-template-files, ai.module, enrichment-pipeline.integration).
- Golden fixtures + eval harness are Phase 3/4 — the integration spec exercises the guard/flow paths with the Mock provider only (0 live API calls).
- Openspec artifacts (`openspec/changes/ai-lifecycle-analysis/*`) are committed separately from source code: `tasks.md` + `apply-progress.md` land as one docs work-unit commit after verification.
