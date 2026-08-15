# Tasks: AI Lifecycle Analysis (classify-lifecycle)

## Review Workload Forecast

| Field                   | Value              |
| ----------------------- | ------------------ |
| Estimated changed lines | 950–1400           |
| 400-line budget risk    | High               |
| Chained PRs recommended | Yes                |
| Suggested split         | PR 1 → PR 2 → PR 3 |
| Delivery strategy       | ask-always         |
| Chain strategy          | pending            |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                             | Likely PR | Notes                                                       |
| ---- | ------------------------------------------------ | --------- | ----------------------------------------------------------- |
| 1    | Manifest candidate capture (`analysis` module)   | PR 1      | Deterministic-only; base `main`; unit tests included        |
| 2    | Capability registration + enrichment integration | PR 2      | Depends on PR 1 (`analysis.frameworkCandidates`); base PR 1 |
| 3    | Fixtures + e2e eval harness                      | PR 3      | Depends on PR 2 (exercises capability); base PR 2           |

## Phase 1: Manifest Candidate Foundation (`analysis`)

- [x] 1.1 RED: `analysis/domain/framework-candidate.vo.spec.ts` — immutability + validation (non-blank framework, non-empty markers)
- [x] 1.2 GREEN: Create `analysis/domain/framework-candidate.vo.ts` — `FrameworkCandidate {framework, file, markers}`
- [x] 1.3 RED: `manifest-framework-detector.spec.ts` — `package.json` with `@nestjs/core` → `[nestjs]`; no manifest → `[]`
- [x] 1.4 GREEN: Create `analysis/application/manifest-framework-detector.ts` — package.json-only marker map (ADR-2; non-TS deferred)
- [x] 1.5 GREEN: `analysis/domain/analysis.entity.ts` — additive nullable `frameworkCandidates` field
- [x] 1.6 RED/GREEN: `analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity.ts` + repo — jsonb round-trip spec
- [x] 1.7 GREEN: `analysis/application/static-analysis.service.ts` — run detector after IR build, persist candidates (ADR-1)

## Phase 2: Capability Registration + Enrichment (`ai`)

- [x] 2.1 GREEN: Create `ai/ai.capabilities/classify-lifecycle/v1/examples.json` — ≥1 few-shot per framework (nestjs/express/unknown) aligned to `LifecycleEnrichmentDto`
- [x] 2.2 GREEN: `ai/ai.module.ts` — register `classify-lifecycle` v1 templates + outputFormat (startup discoverable scenario)
- [x] 2.3 RED: `enrichment.service.spec.ts` — `detectFrameworkCandidates(analysis)` returns `{ candidates, primary }` (no deterministic confidence); no manifest → `unknown`/`[]` (never guessed)
- [x] 2.4 GREEN: `ai/application/enrichment.service.ts` — replace `detectFramework(ir)` (line 228) with candidates + config loader (ADR-3)
- [x] 2.5 GREEN: `ai/application/prompt-builder.service.ts` — inject `{{framework_candidates}}`
- [x] 2.6 GREEN: Integration spec (Mock provider → 3 gates → `IrEnrichment` persist); unvalidated output never persisted

## Phase 3: Golden + Tripwire Fixtures

- [ ] 3.1 GREEN: Create `test/fixtures/mini-express/**` — express golden source (controller, DTOs, entry points)
- [ ] 3.2 GREEN: Create `ai/ai.fixtures/classify-lifecycle/{manifestSha}.response.json` — golden expected classifications (express; re-verify nestjs `abc123`)
- [ ] 3.3 GREEN: Create injection-tripwire fixtures — comment injection + `.env` deny-list

## Phase 4: Evaluation Harness

- [ ] 4.1 GREEN: Create `test/ai-lifecycle.e2e-spec.ts` (under `test/jest-e2e.json`) — golden nestjs/express classification equality, Mock provider only
- [ ] 4.2 GREEN: Determinism e2e — `ai.enabled=false` → pipeline stages unchanged, no AI stage runs
- [ ] 4.3 GREEN: Tripwire e2e — injected instructions have no effect; `.env` excluded from prompt
- [ ] 4.4 REFACTOR: `pnpm -r test` + `pnpm -r build` green; confirm CI makes 0 live API calls
