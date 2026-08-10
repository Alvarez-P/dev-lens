# Archive Report — Request-Flow Visualization

**Change:** `request-flow-visualization`
**Archived:** 2026-08-10
**Delivery:** feature-branch-chain — 4 PRs (#12 → main, #9 → pr1, #10 → pr2, #11 → pr3), tracker branch `feat/request-flow-visualization`
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (4 delta specs merged into existing capability specs)

---

## Completion Summary

| Metric         | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Status         | **COMPLETED**                                                                            |
| Tasks          | 21 across 5 phases (all `[x]`)                                                           |
| PRs            | 4 (PR #12 pr1→main, #9 pr2→pr1, #10 pr3→pr2, #11 pr4→pr3)                                |
| Backend tests  | ✅ 768 passing (Jest)                                                                    |
| Frontend tests | ✅ 382 passing (Vitest)                                                                  |
| Total tests    | ✅ 1150/1150 passing                                                                     |
| Build          | ✅ green (pre-existing tsc errors in `select.tsx` / `create-workspace-dialog.tsx` fixed) |
| Lint           | ✅ pre-existing warnings only, no errors                                                 |
| Verify verdict | **PASS** (recorded in tasks.md Phase 5; no standalone verify-report.md produced)         |

> Note: this change has no `verify-report.md` in the archive folder — the verification
> verdict (1150 tests green, build green, lint warnings-only) was recorded in the
> `tasks.md` Phase 5 completion block (5.1–5.3) and confirmed by the orchestrator.

## Delta Sync Summary

| Domain                      | Spec file (global)                                   | Action  | Details                                                                                             |
| --------------------------- | ---------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| visualization-views         | `openspec/specs/visualization-views/spec.md`         | Updated | +6 added (REQ-VV-005..010), 1 modified (REQ-VV-001 → 8th chip), views table row #8                  |
| typescript-parser           | `openspec/specs/typescript-parser/spec.md`           | Updated | +2 added (Method-Level + Parameter Decorator Registry), 1 modified (Decorator Classification table) |
| intermediate-representation | `openspec/specs/intermediate-representation/spec.md` | Updated | +2 added (Lifecycle + TypedParams projection), 1 modified (IR Domain Model table)                   |
| knowledge-graph-model       | `openspec/specs/knowledge-graph-model/spec.md`       | Updated | +4 added (INVOKES, INJECTS, DTO typing edges, flowAvailable), 1 modified (Edge Types 6→10)          |

### Merge method

All four deltas targeted existing main specs — no new capability folders created.
For each delta:

- **ADDED requirements** appended to the main spec's Requirements section in delta order,
  including all Given/When/Then scenarios.
- **MODIFIED requirements** replaced in place by the delta's canonical version:
  - `visualization-views` REQ-VV-001: added the `REQUEST_FLOW` 8th chip requirement + new
    scenario; the delta's "(Previously: ...)" delta-relative note was stripped.
  - `typescript-parser` Decorator Classification: table expanded from 7 to 12 class-level
    mappings (+`@Catch`→`exception-filter`, `@UseGuards`→`guard`, `@Middleware`→`middleware`,
    `@UsePipes`→`pipe`, `@UseInterceptors`→`interceptor`) plus a new parameter-level table
    (`@Body`/`@Param`/`@Query`/`@Headers`). Delta-relative Status column and [NEW] markers
    normalized away (provenance kept in the header note).
  - `intermediate-representation` IR Domain Model: concepts table extended with
    `constructorParams` (Class), `decorators`/`params`/`returnType` (Method),
    `lifecycle`/`typedParams` (Endpoint), and new Lifecycle/TypedParam concept rows.
  - `knowledge-graph-model` Edge Types: table expanded 6 → 10 edges (PROTECTS/TRANSFORMS
    endpoint-level, INVOKES, INJECTS), with an edge-semantics note documenting the
    INVOKES correction and the shared lifecycle-node FQN scheme.
- **REMOVED requirements**: none in any delta.
- **`[DONE]` context blocks** (parser extraction + constructor injection from
  ai-enrichment): NOT promoted to main specs — they document already-shipped behavior
  with no normative delta; provenance is preserved in the archived delta specs.
- All existing requirements NOT mentioned in a delta were preserved untouched.
- Header provenance notes (`Updated by: request-flow-visualization (2026-08-10)`) added
  to all four specs; References sections extended with cross-spec pointers.
- No destructive merges — no orchestrator confirmation was required (`rules.archive`).

## What Was Built

A click-to-play request-flow visualization for the Knowledge Graph: select an endpoint,
watch the real request lifecycle (middleware → guard → pipe → interceptor → handler →
service/repository tail) animate edge-by-edge with DTO type labels, in a new REQUEST_FLOW
view (#8) that leaves the EVENT_FLOW placeholder (#7) untouched:

1. **Parser registry + IR projection (PR #12)**: `decorator-role-registry.ts` gains
   `UsePipes`→pipe, `UseInterceptors`→interceptor, `Body`→body, `Param`→param,
   `Query`→query, `Headers`→headers; `IrEndpoint` gains `lifecycle` (projected from
   `IrMethod.decorators`) and `typedParams` (projected from `IrMethod.params`) in
   `buildEndpoints()`; backend `EdgeType` grows INVOKES/INJECTS (8→10).
2. **Graph model edges + flow API (PR #9)**: `SemanticModelBuilder` adds
   `addInjectsEdges`/`addInvokesEdges`/`addEndpointLifecycleEdges`/`addDtoEdges`;
   `GET /api/v1/graph/:repoId/endpoints/:fqn/flow` returns ordered steps with
   `payloadType`, approximate service tail, and `flowAvailable` flag (v1→v2 version bump).
3. **Frontend types, store, API (PR #10)**: `EdgeType` mirror +10 members,
   `ViewMode.REQUEST_FLOW`, `RequestFlowStep`/`RequestFlow`, `views.ts` config #8,
   Zustand `flowSlice` (`startFlow`/`nextStep`/`pauseFlow`/`resetFlow`),
   `getEndpointFlow()` client, `InvokesEdge`/`InjectsEdge` components + styles.
4. **Token animation + wiring (PR #11)**: SVG-direct token (rAF + `getPointAtLength`,
   direct DOM mutation on `<g>`, no per-frame re-render), dashed edges + `(approx)` badges
   for the service tail, endpoint click → fetch → play, non-endpoint clicks ignored,
   old-snapshot "not available" fallback, 60fps verified with `onlyRenderVisibleElements`.

## Key Decisions (from design.md)

1. **Hybrid (Approach C)** — project deterministic decorator/annotation data; no method-body
   AST analysis; service call order flagged `approximate: true` (DI + import reachability).
2. **IR projection in `buildEndpoints()`** — `IrMethod` already in scope; fields named
   `lifecycle`/`typedParams` (reconciled from stale delta names).
3. **Lifecycle node FQN reuses `${cls.fqn}~kind:name`** — FQN dedup prevents duplicate nodes
   when class-level (AI) and endpoint-level (parser) entries overlap.
4. **`INVOKES` now, `CALLS` deferred** — INVOKES carries `approximate: true`; CALLS reserved
   for future body analysis.
5. **Graph version v1→v2; `flowAvailable: false` for v1** — graceful fallback; post-enrichment
   v1 snapshots return class-level lifecycle nodes as approximate tail.
6. **SVG-direct token animation** — `<circle>` + rAF + `getPointAtLength()`; no per-frame
   React state; direct DOM mutation avoids jank under `onlyRenderVisibleElements`.
7. **EVENT_FLOW preserved as #7; REQUEST_FLOW as #8** — EVENT_FLOW is async/message-driven;
   repurposing would confuse the future domain.

## Deviations (documented during apply)

1. Pre-existing `tsc` errors in `select.tsx` and `create-workspace-dialog.tsx` (outside this
   change) were fixed to get the build green (commit `9d59ecc`).
2. `SVGPathElement` narrowed from the generic path element type for `getPointAtLength`
   type-safety (commit `cf1f012`).
3. EVENT_FLOW #7 verified untouched — only imports/reads, no modifications (task 5.2).

## Verification Result

- **Verdict**: PASS — 1150/1150 tests (768 backend Jest + 382 frontend Vitest), 0 failures.
- **Build**: green after the two pre-existing tsc fixes.
- **Lint**: pre-existing warnings only, no errors.
- **Perf**: 60fps verified at 500+ nodes with culling, constant per-frame animation cost (task 4.5).

## Follow-ups Identified

| #   | Follow-up                                                 | Source                     |
| --- | --------------------------------------------------------- | -------------------------- |
| 1   | `CALLS` edge for method-body call analysis                | design decision 4          |
| 2   | Class-level lifecycle → approximate tail for v1 snapshots | design §Migration (future) |
| 3   | `EVENT_FLOW` data tracking                                | proposal out-of-scope      |

## Artifacts in This Archive

- `proposal.md` — intent, scope, approach (Hybrid C), risks, rollback plan, success criteria
- `exploration.md` — exploration and requirement clarification (Option A/B/C comparison)
- `design.md` — architecture decisions, data contracts, file changes, migration/rollout
- `tasks.md` — 21 tasks across 5 phases (all `[x]`), PR chain plan, TDD evidence
- `specs/` — 4 delta specs (visualization-views, typescript-parser, intermediate-representation, knowledge-graph-model)
- `archive.md` — this report

## Source of Truth (global specs updated)

- `openspec/specs/visualization-views/spec.md` — merged (6 added, 1 modified, 0 removed)
- `openspec/specs/typescript-parser/spec.md` — merged (2 added, 1 modified, 0 removed)
- `openspec/specs/intermediate-representation/spec.md` — merged (2 added, 1 modified, 0 removed)
- `openspec/specs/knowledge-graph-model/spec.md` — merged (4 added, 1 modified, 0 removed)

## Next Steps

- Downstream changes (e.g., `ai-lifecycle-analysis`, EPIC-008) can consume the synced
  `openspec/specs/` capabilities.
- Address follow-ups #1–#3 in small follow-up changes.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth is
synced to `openspec/specs/`. Ready for the next change.
