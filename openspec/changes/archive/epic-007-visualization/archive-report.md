# Archive Report — EPIC-007 Visualization

**Change:** `epic-007-visualization`
**Archived:** 2026-08-05
**Branch chain:** `feat/visualization` (C1) → `feat/viz/data-layer` (C2) → `feat/viz/canvas` (C3) → `feat/viz/navigation` (C4) → `feat/viz/views` (C5) — stacked-to-main
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (4 new capability specs + 1 delta merged into `knowledge-graph-query-api`)

---

## Completion Summary

| Metric            | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Status            | **COMPLETED** (C1–C5)                                                |
| Tasks             | 20 of 23 across C1–C5 (all `[x]`); C6 (3 tasks) **GATED — deferred** |
| Backend tests     | ✅ 492 passing / 0 failed (63 suites)                                |
| Frontend tests    | ✅ 318 passing (24 files)                                            |
| Verify verdict    | **PASS WITH WARNINGS** — 0 CRITICAL, 7 non-blocking warnings         |
| Coverage          | ➖ No coverage threshold configured (project-level)                  |
| Delivery strategy | ask-always; chained/stacked-to-main PRs (review budget 400 lines)    |

## Slice Completion Summary (C1–C5)

| Slice | Scope                            | Branch                | Status   | Files (A/M) | Key deliverables                                                                   |
| ----- | -------------------------------- | --------------------- | -------- | ----------- | ---------------------------------------------------------------------------------- |
| C1    | KG API extensions (backend)      | `feat/visualization`  | ✅ Done  | 4 / 12      | Export endpoint, `type[]` filter, `direction` param, JWT + membership guard        |
| C2    | Frontend data layer              | `feat/viz/data-layer` | ✅ Done  | 15 / 3      | Graph types, normalize/adjacency, KG API client, TanStack hooks, Zustand store     |
| C3    | Canvas engine                    | `feat/viz/canvas`     | ✅ Done  | 42 / 4      | GraphRendererAdapter, React Flow adapter, dagre/d3-force layouts, 12 nodes/6 edges |
| C4    | Progressive loading & drill-down | `feat/viz/navigation` | ✅ Done  | 8 / 3       | Breadcrumbs, detail panel, chunk streaming + version polling, drill-down/focus     |
| C5    | Views & filtering                | `feat/viz/views`      | ✅ Done  | 13 / 18     | Filter bar, view presets/toolbar, search, keyboard, context menu, graph route      |
| C6    | WebGL scale engine               | (not created)         | ⛔ GATED | —           | Deferred pending real-repo perf gate (>2k nodes); no branch/PR opened              |

**Totals across C1–C5**: 82 files added, 40 files modified (122 changed files, per slice-tip git diffs; includes tests, SDD artifacts, and docs commits).

## Capabilities Delivered

| Domain                    | Spec file (global)                                 | Status         |
| ------------------------- | -------------------------------------------------- | -------------- |
| visualization-engine      | `openspec/specs/visualization-engine/spec.md`      | NEW (created)  |
| graph-navigation          | `openspec/specs/graph-navigation/spec.md`          | NEW (created)  |
| visualization-views       | `openspec/specs/visualization-views/spec.md`       | NEW (created)  |
| visualization-interaction | `openspec/specs/visualization-interaction/spec.md` | NEW (created)  |
| knowledge-graph-query-api | `openspec/specs/knowledge-graph-query-api/spec.md` | DELTA (merged) |

### Delta merge details — `knowledge-graph-query-api`

| Type     | Requirement                  | Details                                                                                     |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| ADDED    | Graph Export Endpoint        | `GET /:repoId/export` — all nodes+edges, `meta{nodeCount,edgeCount,version}`, null on empty |
| ADDED    | JWT Guard on Graph Endpoints | 401 unauthenticated / 403 non-member; class-level `@UseGuards`                              |
| MODIFIED | Query Node Neighborhood      | `direction` param (`in`/`out`/`both` default); stale W8 note removed                        |
| MODIFIED | Filter by Node Type          | `type[]` repeated params; single `type` backward-compat; stale W9 note removed              |
| MODIFIED | Error Responses              | JWT 401/403 enforcement added; stale S5/W5 note removed                                     |
| REMOVED  | —                            | None                                                                                        |

## Test Results

| Layer                    | Count      | Detail                                                     |
| ------------------------ | ---------- | ---------------------------------------------------------- |
| Backend (C1, Jest)       | **492** ✅ | 63 suites, 0 failures, 0 skipped                           |
| Frontend (C2–C5, Vitest) | **318** ✅ | 24 test files (lib/visualization 11 + components/graph 13) |

- Backend: `cd src/backend && pnpm test` — 22.4s, all green.
- Frontend: 24 visualization test files covering normalize, graph-api, hooks, store, layout engines, adapter conformance, 12 node/6 edge components, filter presets, search, keyboard, context menu, workspace (9 tests).
- E2E: Playwright graph spec **not added** (see W2) — route sits behind client-side ProtectedRoute and the KG API; no backend/auth seed exists in this env. Full flow covered by `graph-workspace.test.tsx` (9 tests) + component tests.
- Type check: strict TS on all packages; build gated per CI.

## Files Created / Modified (per slice tip diffs)

| Slice     | Added  | Modified | Notes                                                                       |
| --------- | ------ | -------- | --------------------------------------------------------------------------- |
| C1        | 4      | 12       | Backend DTOs, service, repo, guard, controller, specs, tests                |
| C2        | 15     | 3        | `lib/visualization/*`, store, hooks, tests                                  |
| C3        | 42     | 4        | Canvas, adapter, layouts, 12 nodes / 6 edges, tests                         |
| C4        | 8      | 3        | Breadcrumbs, detail panel, progressive-load, drill-down                     |
| C5        | 13     | 18       | Filter bar, toolbar/views, search, keyboard, context menu, route, page link |
| **Total** | **82** | **40**   | **122 changed files**                                                       |

## Branch Chain (stacked-to-main)

| Slice | Branch                | Tip commit (C-slice head) | Notes                                                                  |
| ----- | --------------------- | ------------------------- | ---------------------------------------------------------------------- |
| C1    | `feat/visualization`  | `bd94656`                 | Plan named it `feat/viz/kg-api`; actual branch is `feat/visualization` |
| C2    | `feat/viz/data-layer` | `733fcd9`                 |                                                                        |
| C3    | `feat/viz/canvas`     | `5f5c14f`                 |                                                                        |
| C4    | `feat/viz/navigation` | `5a52f04`                 |                                                                        |
| C5    | `feat/viz/views`      | `06ac96b` (current HEAD)  |                                                                        |
| C6    | —                     | —                         | No branch created (gated)                                              |

Chain rule followed: C1 merged first (backend dependency), C2–C5 sequential; each slice diff shows only its own slice. Chain is not yet merged to `main` (HEAD `f2122db`); PRs remain open/stacked per delivery strategy.

## Outstanding Warnings (7 non-blocking, from verify phase)

1. **REQ-API-05 — 401/403 Swagger annotations on `getNode`/`getEdges`** (verify-report C1). Documentation-only gap at verify time; guards active class-level, tests prove 401/403. Addressed in follow-up commit `bd94656` (docs annotations added).
2. **No Playwright graph e2e** (C5-08 apply note). Route is behind ProtectedRoute + real KG API; no backend/auth seed in this env. Covered by 9 `graph-workspace` component tests + 24 unit/component files.
3. **Snapshot/pagination endpoint contract** (C2-03 apply note). Client uses `GET /api/v1/graph/:repoId` (not `/snapshot`) and `page`/`limit` (not `offset`) per implemented backend; spec wording differs from wire contract.
4. **ReactFlowProvider contained inside the adapter** (C3-05 apply note). Adapter is self-contained; `GraphCanvas` wraps it + adds `filter.ts`/`viewport.ts` — deviation from design's provider placement, isolation preserved.
5. **GraphWorkspace deferred from C4 to C5** (C4-03 apply note). C4 delivered the `useProgressiveLoad` hook; workspace component + route landed in C5. `loadingSlice` added to store beyond original slice plan.
6. **Views as pure configs, not per-view components** (C5-04 apply note). `lib/visualization/views.ts` configs drive existing layout engines; Event Flow placeholder renders in GraphWorkspace. Dependency Tree uses actual enum `EXPOSES` (spec said "EXPORTS").
7. **Graph store location + adapter barrel** (C2-05/C3-02 apply notes). Store at `lib/visualization/store/graph-store.ts` (not `lib/store/use-graph-store.ts`); adapter interface created in C2 at `lib/visualization/adapter.ts` with `components/graph/graph-renderer-adapter.ts` as re-export barrel.

All warnings are non-blocking; none require changes to archived specs.

## C6 Status — GATED

- **C6 (WebGL scale engine)** is **GATED**, not complete: the real-repo perf gate (>2k nodes, decision before build) has NOT been run. Tasks C6-01..C6-03 remain open and are excluded from this archive's completion scope.
- Deferred pending: real-repo perf testing; gate decision recorded in `design.md`; then Cytoscape adapter + factory (A/B flag, default ReactFlowAdapter).
- The `GraphRendererAdapter` abstraction (C3) keeps the future WebGL swap isolated from interaction/data layers.

## Key Architecture Decisions (from design.md)

1. `GraphRendererAdapter` isolates React Flow 12.11 behind an interface → C6 Cytoscape swap without touching UI layers (RFC-008 §5.1).
2. Zustand slices (selection/view/filter/navigation) over React Context — prevents re-render cascades.
3. Snapshot-first loading (snapshot → 200-node chunks) — first paint within 200 nodes; version poll every 30s with changed-node pulse.
4. dagre (hierarchy) + d3-force (mesh); fcose optional; **ELKJS excluded** (EPL/GPL dual license) — all-MIT stack.
5. Client-side layer/domain derivation via `filePath` heuristics (EPIC-006 pattern) — no backend changes for views 5–6.
6. No multi-select in v1 (spec-mandated); single-select simplifies store.

## Artifacts in This Archive

- `proposal.md` — intent, scope, capabilities, approach, risks, rollback, slice plan (C1–C6)
- `design.md` — tech stack, architecture decisions, data flow, component tree, adapter contract, node/edge visual mapping
- `tasks.md` — 23 tasks across C1–C6 (C1–C5 `[x]`; C6 gated), PR chain plan, work-unit notes with deviations
- `verify-report.md` — C1 verification: 492 backend tests, compliance matrix, PASS WITH WARNINGS verdict
- `specs/` — 5 delta specs (visualization-engine, graph-navigation, visualization-views, visualization-interaction, knowledge-graph-query-api delta)
- `archive-report.md` — this report

## Source of Truth (global specs updated)

- `openspec/specs/visualization-engine/spec.md` — created (4 requirements: VE-001..004)
- `openspec/specs/graph-navigation/spec.md` — created (5 requirements: GN-001..005)
- `openspec/specs/visualization-views/spec.md` — created (4 requirements: VV-001..004)
- `openspec/specs/visualization-interaction/spec.md` — created (5 requirements: VI-001..005)
- `openspec/specs/knowledge-graph-query-api/spec.md` — merged (2 added, 3 modified, 0 removed)

## Next Steps

- Run the C6 perf gate on a real repo (>2k nodes); if passed, plan C6 as a new change (Cytoscape adapter + factory).
- Merge the stacked PR chain to `main` (chain currently not merged; `main` HEAD `f2122db`).
- Update EPIC-007 tracking doc status to **Completed** (done in this archive).
- Downstream epics (EPIC-008 AI, EPIC-009 docs, EPIC-010 search, EPIC-011 metrics) can consume the synced `openspec/specs/visualization-*` capabilities.
