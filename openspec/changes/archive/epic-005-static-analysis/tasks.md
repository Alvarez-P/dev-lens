# Tasks: EPIC-005 — Static Analysis Engine

## Review Workload Forecast

| Slice | Est lines | 400-risk | PR  |
| ----- | --------- | -------- | --- |
| C1    | ~420      | Medium   | #1  |
| C2    | ~400      | Medium   | #2  |
| C3    | ~450      | Med-High | #3  |
| C4    | ~420      | Medium   | #4  |
| Total | ~1700     | High     | 4   |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

## Suggested Work Units

| Unit | Goal                           | Likely PR                         | Notes                                |
| ---- | ------------------------------ | --------------------------------- | ------------------------------------ |
| C1   | Parser foundation + events     | #1 (base: `feat/static-analysis`) | Detection, ts-morph, registerHandler |
| C2   | IR model + builder + validator | #2 (base: #1)                     | VOs, round-trip, persistence         |
| C3   | Pipeline + integration         | #3 (base: #2)                     | Service, BullMQ, wiring, E2E         |
| C4   | Incremental analysis           | #4 (base: #3)                     | Manifest, partial re-parse           |

## Conventions

Layers (D/A/I/K) under `src/backend/src/modules/analysis/`; tests mirror src at `test/unit/modules/analysis/{layer}/`; E2E `test/e2e/analysis/`. TDD: RED→GREEN→REFACTOR.

## Phase 1 — C1 (PR #1)

- [x] 1.1 (D) `language.vo.ts` Language VO
- [x] 1.2 (D) `parsed-file.vo.ts`+`parse-result.vo.ts`+Diagnostic. Dep: 1.1
- [x] 1.3 (D) `interfaces/language-parser.interface.ts`+`parser-registry.interface.ts`. Dep: 1.2
- [x] 1.4 (K) dispatcher `registerHandler`+Map routing; fix UnitOfWork
- [x] 1.5 (D) `analysis-events.ts` 3 events. Dep: 1.4
- [x] 1.6 (D) `services/language-detector.service.ts` ext map, skip unknown. Dep: 1.1
- [x] 1.7 (I) `parsers/parser-registry.ts` InMemory. Dep: 1.3
- [x] 1.8 (I) `parsers/decorator-role-registry.ts` defaults+register
- [x] 1.9 (I) pkg +ts-morph; `typescript-parser.ts`. Dep: 1.2,1.8
- [x] 1.10 barrel `index.ts`. Dep: 1.1–1.9
- [x] Verify: build, unit, lint

## Phase 2 — C2 (PR #2)

- [x] 2.1 (D) `ir-nodes.ts` 10 VOs, fqn, immutable. Dep: 1.1
- [x] 2.2 (D) `services/ir-validator.service.ts` 4 checks, batch. Dep: 2.1
- [x] 2.3 (I) `parsers/typescript/typescript-ir-builder.ts` ParseResults→IrProject. Dep: 1.2,1.9,2.1
- [x] 2.4 (D) `analysis.entity.ts`+`analysis-id.vo.ts`+`analysis-status.enum.ts`+`analysis-errors.ts`
- [x] 2.5 (I) `persistence/typeorm/analysis.typeorm-entity.ts` (JSONB)+`persistence/repositories/analysis.repository.ts`. Dep: 2.4
- [x] Verify: build, unit, lint

## Phase 3 — C3 (PR #3)

- [x] 3.1 (K) `repositories.module.ts` export `SnapshotRepository`
- [x] 3.2 (A) `application/static-analysis.service.ts` pipeline, idempotent, failed. Dep: 1.4–1.9,2.2,2.3,2.5,3.1
- [x] 3.3 (I) `jobs/analysis.job-processor.ts` queue, retry3, DLQ. Dep: 3.2
- [x] 3.4 (I) `analysis-event-handler.ts` subscribe+enqueue. Dep: 1.4, 3.3
- [x] 3.5 (I) `analysis.module.ts` wiring (forFeature, queue, providers). Dep: 3.1–3.4
- [x] 3.6 (K) pkg `typescript`→deps; `app.module.ts` import. Dep: 3.5
- [x] 3.7 (I) `OnModuleInit` registerHandler (no SharedModule cycle). Dep: 3.4,3.5
- [x] 3.8 (E2E) `test/e2e/analysis/analysis.e2e-spec.ts`+`fixtures/mini-nestjs/`; recreate jest-e2e.json. Dep: 3.5–3.7
- [x] Verify: build, unit, e2e, lint

## Phase 4 — C4 (PR #4)

- [x] 4.1 (I) `analysis.repository.ts` add `findLatestByRepo`. Dep: 2.5
- [x] 4.2 (A) `application/file-manifest.service.ts` SHA-256+diff
- [x] 4.3 (K) `config/configuration.ts` `STATIC_ANALYSIS_THRESHOLD`=0.5
- [x] 4.4 (A) `static-analysis.service.ts` incremental, reuseRatio, fallback. Dep: 3.2,4.1,4.2,4.3
- [x] 4.5 (E2E) `test/e2e/analysis/incremental.e2e-spec.ts`+`fixtures/repo-v1|repo-v2`, reuse>0. Dep: 4.4
- [x] Verify: build, unit, e2e, lint

## Dependency Graph

Cross-slice: C1→C2 (2.3 uses 1.2/1.9)→C3 (3.2 uses C1+2.2/2.3/2.5)→C4 (4.4 uses 3.2+4.1). Within-slice: Deps, never later. PRs #1→#4 retargeted; `feat/static-analysis` merges to main.
