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

---

# Apply Progress — PR 2: JD Round-2 Closure (confidence removal + loader hardening)

**Context**: Judgment-day round 2 flagged two non-blocking warnings: (1) dead deterministic `confidence` field on `FrameworkCandidateResult` — spec drift vs. the `{ candidates, primary }` contract; (2) `loadExamples()` hardened defensive branches with no covering tests. Both closed here; production behavior unchanged.

## TDD Cycle Evidence

| Task | Test File                                                                     | Layer | Safety Net                      | RED                                                  | GREEN                           | TRIANGULATE                                                                                    | REFACTOR                            |
| ---- | ----------------------------------------------------------------------------- | ----- | ------------------------------- | ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| W2   | `src/backend/test/unit/modules/ai/application/prompt-template-loader.spec.ts` | Unit  | ✅ modules/ai 41 suites 401/401 | — (branch already implemented; coverage-gap closure) | ✅ Passed 14/14 in file (3 new) | ✅ 3 cases: literal `null` / primitive value / non-array `examples` — each exercises one guard | ➖ None (production code untouched) |

## Commits (work units)

| Commit               | Message                                                                | Files                                                                                                                |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `31b5fac`            | `fix(ai): drop dead detection confidence and harden example loading`   | enrichment.service.ts, prompt-template-loader.service.ts, enrichment.service.spec.ts, prompt-template-loader.spec.ts |
| `(this docs commit)` | `docs(sdd): reconcile detection contract wording in spec/tasks/design` | specs/ai-lifecycle-classification/spec.md, tasks.md, design.md, apply-progress.md                                    |

## Verification (JD round-2 closure boundary)

- ✅ `npx tsc --noEmit -p tsconfig.json` exit 0
- ✅ `npx jest --config jest.config.js --testPathPattern "modules/ai" --runInBand`: 41 suites, **404/404** passing (+3 new loader tests)

---

# Apply Progress — PR 3: Golden + Tripwire Fixtures and Evaluation Harness

**Change**: ai-lifecycle-analysis
**Slice**: Phase 3 (golden + tripwire fixtures) + Phase 4 (evaluation harness) — PR 3 of feature-branch-chain (targets `feat/ai-lifecycle-analysis`)
**Mode**: Strict TDD (openspec `testing.strict_tdd: true`)
**Chain strategy**: feature-branch-chain
**Branch**: `feat/ai-lifecycle-pr3-fixtures-eval`
**Base**: `feat/ai-lifecycle-analysis` @ `fa3fb8a` (includes merged PR 1 + PR 2 via #43)

## Scope (this slice)

Tasks 3.1–3.4 (fixtures + eval harness). No production behavior changes: `analysis`/`ai` modules untouched — the harness consumes existing services (MockProvider default fixtures dir, real parser/IR/sketch/prompt pipeline) read-only.

## TDD Cycle Evidence

| Task | Test File                                                       | Layer | Safety Net      | RED                                                                   | GREEN                             | TRIANGULATE                                                                                          | REFACTOR                                                            |
| ---- | --------------------------------------------------------------- | ----- | --------------- | --------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 3.1  | `test/e2e/ai-lifecycle.e2e-spec.ts` (express golden case)       | E2E   | ✅ e2e/ai 15/15 | ✅ Written (ENOENT `mini-express`)                                    | ✅ Passed                         | ✅ 3 classes: controller/service/DTO + middleware-chain architecture                                 | ✅ Clean (type-correct fixtures under `tsc`)                        |
| 3.2  | (same — golden equality asserts the committed `{sha}` response) | E2E   | ✅ e2e/ai 15/15 | — (data; consumed by the 4.1 harness)                                 | ✅ Passed (sha-keyed fixture hit) | ✅ aligned to `LifecycleEnrichmentDto` shape (mirrors `abc123` + examples.json express few-shot)     | ✅ Clean                                                            |
| 3.3  | (same — tripwire cases)                                         | E2E   | ✅ e2e/ai 15/15 | ✅ Written (ENOENT `tripwire/injected.controller.ts`, `.env.example`) | ✅ Passed                         | ✅ 2 fixtures: comment-injection file + `.env.example` deny-list — both consumed by the 4.3 harness  | ✅ Clean                                                            |
| 4.1  | `test/e2e/ai-lifecycle.e2e-spec.ts`                             | E2E   | ✅ e2e/ai 15/15 | ✅ Written (fixtures missing)                                         | ✅ Passed 2/2                     | ✅ 2 cases: express (committed golden, real ai.fixtures dir) + nestjs (abc123 reference re-verified) | ✅ Clean (status projection helper)                                 |
| 4.2  | (same — determinism describe)                                   | E2E   | ✅ e2e/ai 15/15 | ✅ Written (fixtures missing)                                         | ✅ Passed 1/1                     | ✅ control(enabled)→enqueue vs disabled→no enqueue + byte-identical IR/candidates/manifest-sha       | ✅ Clean                                                            |
| 4.3  | (same — tripwire describe)                                      | E2E   | ✅ e2e/ai 15/15 | ✅ Written (fixtures missing)                                         | ✅ Passed 2/2                     | ✅ injection absent from sketch+prompt+output; `.env` denied at filter/manifest/IR/prompt layers     | ✅ Clean                                                            |
| 4.4  | — (REFACTOR/verify)                                             | —     | —               | —                                                                     | —                                 | —                                                                                                    | ✅ `tsc` clean + unit 1249/1249 + e2e 20/20 + `pnpm -r build` green |

## Safety Net Baseline (pre/post)

- Pre-change (`fa3fb8a`):
  - `npx jest --config jest.config.js --testPathPattern unit --runInBand`: 139 suites, **1249/1249** passing
  - `npx jest --config test/jest-e2e.json ai --runInBand`: 3 suites, **15/15** passing
  - `npx tsc --noEmit -p tsconfig.json`: **clean (exit 0)**
- Post-change (`HEAD` of `feat/ai-lifecycle-pr3-fixtures-eval`):
  - `npx jest --config jest.config.js --testPathPattern unit --runInBand`: 139 suites, **1249/1249** passing (unchanged)
  - `npx jest --config test/jest-e2e.json ai --runInBand`: 4 suites, **20/20** passing (+5 new harness tests)
  - `npx tsc --noEmit -p tsconfig.json`: **clean (exit 0)**
  - `pnpm -r build`: **green** (0 live API calls — Mock provider only, verified via `providerSelector.getProvider` mock)

## Commits (work units)

| Commit               | Message                                                                     | Files                                                                              |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `(see git log)`      | `test(ai-lifecycle): add express golden corpus and classification response` | test/fixtures/mini-express/** + ai.fixtures/classify-lifecycle/{sha}.response.json |
| `(see git log)`      | `test(ai-lifecycle): add injection-tripwire fixtures`                       | test/fixtures/tripwire/** (package.json, src/, .env.example)                       |
| `(see git log)`      | `test(ai-lifecycle): add golden determinism and tripwire eval harness`      | test/e2e/ai-lifecycle.e2e-spec.ts                                                  |
| `(this docs commit)` | `docs(sdd): track ai-lifecycle PR3 apply progress`                          | openspec/changes/ai-lifecycle-analysis/apply-progress.md                           |

## Verification (PR3 boundary)

- ✅ Golden equality: express corpus → committed `{manifestSha}.response.json` consumed via the MockProvider **default** fixtures dir (ADR-4); nestjs corpus re-verifies the `abc123` reference (schema gate passes; equality keyed to real mini-nestjs sha)
- ✅ Determinism: `ai.enabled=false` → no `ai-enrichment` enqueue, deterministic IR/frameworkCandidates/manifest byte-identical to the enabled control run
- ✅ Tripwires: `// IGNORE ALL PREVIOUS INSTRUCTIONS` absent from real parser→IR→sketch, from the rendered prompt, and the persisted classification is unaffected; `.env.example` denied by SourceFileFilter, excluded from manifest/IR/prompt (fake secret never leaks)
- ✅ Typecheck + unit (1249) + e2e/ai (20) + `pnpm -r build` all green; 0 live API calls (Mock provider only)
- ✅ Boundary honored: no production code in `analysis`/`ai` modified; Phase 1/2 untouched; only fixtures + harness + docs added

## Deviations from Design

- **Harness size**: `ai-lifecycle.e2e-spec.ts` is ~600 lines (vs the ~200-400 slice estimate). The overage is e2e scaffolding that mirrors the two established patterns (`analysis.e2e-spec.ts` module boot + `enrichment-pipeline.integration.spec.ts` pipeline builder) — not product logic. Orchestrator explicitly forbade splitting PR 3 further; flagging the size for the PR decision.
- **NestJS golden keying**: the committed `abc123.response.json` is a placeholder key (does not match mini-nestjs's real manifest sha). The harness re-verifies the reference shape (schema gate) and writes the derived expected response under the real sha into a temp fixtures dir — no duplication of the reference file.
- **`.env` deny-list fixture**: named `.env.example` (the repo's `.gitignore` ignores `.env*` but keeps `.env.example`, mirroring the existing root file); `SourceFileFilter`'s `ENV_FILE_PATTERN` denies it (`\.env\.`).
- **Golden contract equality**: persisted classes carry a validator-added `status` field (pipeline bookkeeping); the harness projects to the six-field golden contract via `toGoldenClass()` instead of coupling assertions to `status`.

## Notes

- Golden response key: `1414b73d…` (sha of the committed mini-express corpus; recompute + rename the fixture if the corpus changes — the harness fails fast with `existsSync` when the key drifts).
- FQNs in the golden response embed the harness snapshot id `snap-express-golden` (IR `projectName` = snapshotId); both are constants in the same spec.
- Openspec artifacts committed as a docs work-unit after source commits (PR2 convention).
- Fixture `.ts` files are type-clean under `tsc --noEmit` (express + @types/express resolve in the workspace); no tsconfig changes were needed.
