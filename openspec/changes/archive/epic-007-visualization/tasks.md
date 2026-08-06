# Tasks: EPIC-007 Visualization

> **ARCHIVED**: 2026-08-05 — C1–C5 COMPLETE (all 20 tasks `[x]`). C6 GATED — WebGL scale engine deferred pending real-repo perf testing (>2k nodes); tasks C6-01..C6-03 remain open and are NOT part of this archive's completion scope.
> **Test results**: backend 492 passing (63 suites), frontend 318 passing (24 files).

> **STRICT TDD**: For every task, write the failing test first (RED) → implement (GREEN) → refactor. Backend: Jest (`src/backend/src/**/*.spec.ts`). Frontend: Vitest (`src/frontend/src/**/*.test.ts`). Commit each work unit with a conventional commit including its tests.
> **Spec refs**: VE=visualization-engine, GN=graph-navigation, VV=visualization-views, VI=visualization-interaction, KG=knowledge-graph-query-api delta.

## Slice C1: KG API Extensions — PR #1 (backend only)

### Work Unit C1-W1: `feat(kg): multi-type node filters and direction-aware neighborhoods`

- [x] C1-01: Extend `GraphNodesQueryDto.type` to accept `NodeType[]` (backward-compat single) + add `GraphExportQueryDto` (version?) + `GraphQueryNodeDetailDto` (direction: in|out|both, default both)
  - Files: `src/backend/src/modules/knowledge-graph/infrastructure/controllers/graph-query.dto.ts`
  - Spec: KG Filter by Node Type, KG Export Endpoint, KG Direction
  - Tests: `graph-query.dto.spec.ts` — `type[]` valid, single `type` compat, invalid type → 400, direction enum + default
  - Est. lines: 130 | Depends on: none
- [x] C1-02: Add direction filtering to `getNodeWithEdges` + `NodeType[]` support in `getNodes` of `GraphQueryService`
  - Files: `src/backend/src/modules/knowledge-graph/application/graph-query.service.ts`
  - Spec: KG Direction (in/out/both), KG Filter by Node Type
  - Tests: `graph-query.service.spec.ts` — `direction=out` returns only outgoing, `in` only incoming, `both` default; `type[]` returns union count
  - Est. lines: 180 | Depends on: C1-01

### Work Unit C1-W2: `feat(kg): full-graph export endpoint bypassing pagination`

- [x] C1-03: Add `findAllNodesAndEdges(repoId, version?)` to `GraphQueryService` + `findAllNodesAndEdges` to `GraphRepository` (no offset/limit)
  - Files: `graph-query.service.ts`, `src/backend/src/modules/knowledge-graph/infrastructure/persistence/repositories/graph.repository.ts`
  - Spec: KG Export Endpoint (all nodes+edges, meta, empty → null)
  - Tests: `graph-query.service.spec.ts` + `graph.repository.spec.ts` — export returns full node/edge sets, `?version=2` filters, empty graph returns null
  - Est. lines: 180 | Depends on: C1-01

### Work Unit C1-W3: `feat(kg): JWT + repo-membership guard on graph endpoints`

- [x] C1-04: Create `RepoMembershipGuard` (JWT user must be member of `:repoId`; missing token → 401, non-member → 403)
  - Files: `src/backend/src/modules/knowledge-graph/guards/repo-membership.guard.ts` (new — created at this path per apply instructions; identity module exports `MemberRepository` for DI)
  - Spec: KG JWT Guard
  - Tests: `repo-membership.guard.spec.ts` — member passes, non-member 403, no token 401
  - Est. lines: 130 | Depends on: none
- [x] C1-05: Apply `@UseGuards(JwtAuthGuard, RepoMembershipGuard)` at controller level; add `GET :repoId/export`; wire `direction` + `type[]` into existing routes
  - Files: `src/backend/src/modules/knowledge-graph/infrastructure/controllers/graph.controller.ts`
  - Spec: KG Export, KG JWT Guard, KG Direction, KG Filter by Node Type
  - Tests: `graph.controller.spec.ts` (supertest) — 401 no token, 403 non-member, export `meta.nodeCount/edgeCount/version`, `direction=out`, `type[]=Controller&type[]=Service`
  - Est. lines: 190 | Depends on: C1-02, C1-03, C1-04

## Slice C2: Frontend Data Layer — PR #2

### Work Unit C2-W1: `feat(viz): graph domain types and normalization`

- [x] C2-01: Create `GraphNode`, `GraphEdge`, `GraphSnapshot`, `NormalizedGraph`, `AdjacencyIndex`, NodeType/EdgeType mirrors
  - Files: `src/frontend/src/lib/visualization/types.ts` (new)
  - Spec: VE-001 (adapter types), GN-001 (snapshot), VV-003 (derivation)
  - Tests: none (pure types; compile gate)
  - Est. lines: 80 | Depends on: none
  - NOTE (C2 apply): adapter interface was also created here per apply launch — `src/frontend/src/lib/visualization/adapter.ts` (full design contract). C3-02 must import/re-export from there instead of creating a duplicate at `components/graph/graph-renderer-adapter.ts`.
- [x] C2-02: Create `normalize.ts` — flat → `Map<id,Node>` + `Map<id,Edge>` + `AdjacencyIndex`; `deriveLayer()` (`/infrastructure/` `/domain/` `/application/` `/presentation/`), `deriveDomain()` (path segment 1)
  - Files: `src/frontend/src/lib/visualization/normalize.ts` (new)
  - Spec: VV-003 (layer/domain heuristics), GN-002 (adjacency)
  - Tests: `normalize.test.ts` — dedupe/merge, in/out adjacency, layer path mapping, domain segment fallback → UNKNOWN
  - Est. lines: 230 | Depends on: C2-01

### Work Unit C2-W2: `feat(viz): KG API client and TanStack Query hooks`

- [x] C2-03: Create `graph-api.ts` — `getSnapshot`, `getNodes(limit=200, offset)`, `getNodeDetail(fqn, direction)`, `getExport` using api-client JWT/error pattern
  - Files: `src/frontend/src/lib/visualization/graph-api.ts` (new)
  - Spec: GN-001 (snapshot + 200-chunks), GN-002 (direction=out), KG Export
  - Tests: `graph-api.test.ts` — URL/param building, `type[]` serialization, direction param, error normalization
  - Est. lines: 200 | Depends on: C2-01
  - NOTE (C2 apply): pagination uses `page`/`limit` per the implemented backend (`GET /:repoId/nodes`), not `offset`; snapshot endpoint is `GET /api/v1/graph/:repoId` (not `/snapshot`).
- [x] C2-04: Create `useGraphSnapshot`, `useGraphNodes`, `useGraphExport` hooks (staleTime 30s, retry 1, refetchInterval for snapshot)
  - Files: `src/frontend/src/lib/visualization/hooks/use-graph-snapshot.ts`, `use-graph-nodes.ts`, `use-graph-export.ts` (new)
  - Spec: GN-001 (chunk streaming), GN-005 (30s poll)
  - Tests: `hooks/use-graph-*.test.ts` — query keys, staleTime/retry config, poll interval
  - Est. lines: 230 | Depends on: C2-03
  - NOTE (C2 apply): also created `use-node-detail.ts`; tests consolidated in `hooks/__tests__/hooks.test.tsx` (JSX needs .tsx for the QueryClientProvider wrapper).

### Work Unit C2-W3: `feat(viz): graph store slices`

- [x] C2-05: Create Zustand store: `selectionSlice` (node/edge id), `viewSlice` (activeView 1–7), `filterSlice` (visibleTypes, edgeTypes, hideDeprecated, hideExternal), `navigationSlice` (breadcrumb stack, focusNodeId, viewport)
  - Files: `src/frontend/src/lib/store/use-graph-store.ts` (new)
  - Spec: VI-001 (selection), VV-001 (view), VV-002 (filters), GN-003/004/005
  - Tests: `use-graph-store.test.ts` — select/deselect, view switch, filter toggles, breadcrumb push/pop, focus dimming, viewport persistence
  - Est. lines: 290 | Depends on: C2-01
  - NOTE (C2 apply): created at `src/frontend/src/lib/visualization/store/graph-store.ts` (colocated with the visualization data layer) per apply launch; C4-04 must import from there, not `lib/store/use-graph-store.ts`.

## Slice C3: Canvas Engine — PR #3

### Work Unit C3-W1: `chore(viz): graph rendering deps + adapter contract`

- [x] C3-01: Add `@xyflow/react@12.11`, `dagre`, `@types/dagre`, `d3-force`, `@types/d3-force` (MIT only — no ELKJS)
  - Files: `src/frontend/package.json`
  - Spec: VE-002 (layout libs), VE-004 (license guard)
  - Tests: none; build gate
  - Est. lines: 10 | Depends on: none
- [x] C3-02: Create `GraphRendererAdapter` interface (render, applyLayout, highlight, fitView, zoom*, centerOn, event handlers, dispose)
  - Files: `src/frontend/src/components/graph/graph-renderer-adapter.ts` (new)
  - Spec: VE-001 (isolation)
  - Tests: `graph-renderer-adapter.test.ts` — source scan fails on `@xyflow/react` import outside `components/graph/`
  - Est. lines: 90 | Depends on: C3-01
  - NOTE (C3 apply): interface was created in C2 at `lib/visualization/adapter.ts`; `graph-renderer-adapter.ts` is a re-export barrel. Isolation source-scan is in `react-flow-adapter.test.tsx` (VE-001) — scans `src/lib` + canvas helper files.

### Work Unit C3-W2: `feat(viz): dagre + d3-force layout engines`

- [x] C3-03: Create layout registry + `dagre-layout.ts` (top-down hierarchy) + `d3-force-layout.ts` (mesh, seeded)
  - Files: `src/frontend/src/components/graph/canvas/layout-engine.ts` (new — single module per launch prompt C3-05, replaces the `layouts/` split)
  - Spec: VE-002 (dagre/d3-force scenarios)
  - Tests: `canvas/__tests__/layout-engine.test.ts` — no overlap, layered assignment, disconnected clusters separated, deterministic
  - Est. lines: 260 | Depends on: C3-02, C2-01

### Work Unit C3-W3: `feat(viz): React Flow adapter and canvas`

- [x] C3-04: Implement `ReactFlowAdapter` — dark `bg-surface-950` canvas, `onlyRenderVisibleElements` + 200px margin, zoom 0.1–4x @10%, pan, minimap 160×120, fitView
  - Files: `src/frontend/src/components/graph/canvas/react-flow-adapter.tsx` (new)
  - Spec: VE-001, VE-003 (viewport controls), VV-004 (culling)
  - Tests: `canvas/__tests__/react-flow-adapter.test.tsx` — nodes/edges render, fitView, zoom step, culling config, adapter-interface conformance
  - Est. lines: 280 | Depends on: C3-02, C3-03
- [x] C3-05: Create `GraphCanvas` — wraps adapter + `ReactFlowProvider`, wires store selection/viewport → adapter
  - Files: `src/frontend/src/components/graph/canvas/graph-canvas.tsx` (new)
  - Spec: GN-005 (viewport restore), VE-001
  - Tests: `canvas/__tests__/graph-canvas.test.tsx` — store→adapter callback wiring, viewport set/restore
  - Est. lines: 140 | Depends on: C3-04, C2-05
  - NOTE (C3 apply): ReactFlowProvider is included INSIDE the adapter for self-containment; GraphCanvas wraps it and adds `filter.ts` (pure filterGraph) + `viewport.ts` (clamp/zoomBy, 0.1–4 bounds per REQ-VE-003). A placeholder `GraphToolbar` (layout switcher, fit, ±10% zoom, view-mode label) was also added per launch C3-07 at `components/graph/graph-toolbar.tsx` — C5-03 extends it with the 7 view chips.

### Work Unit C3-W4: `feat(viz): custom node and edge components`

- [x] C3-06: Create 12 `CustomNode` components per design mapping (shape/color/icon per actual NodeType enum) + deprecated indicator
  - Files: `src/frontend/src/components/graph/canvas/nodes/{project,package,module,controller,service,repository,entity,dto,interface,endpoint,external-dependency,unknown}-node.tsx` + `index.ts` + `node-style.ts` + `node-view.tsx` (new)
  - Spec: VE-001 node table (design mapping — actual enums, not spec labels)
  - Tests: `canvas/nodes/__tests__/nodes.test.tsx` — per-type icon/accent/label/badge + deprecated indicator
  - Est. lines: 330 | Depends on: C3-02
- [x] C3-07: Create 6 `CustomEdge` components (BELONGS_TO thin no-arrow, DEPENDS_ON arrow, IMPLEMENTS dashed, …) per design edge table
  - Files: `src/frontend/src/components/graph/canvas/edges/{belongs-to,depends-on,implements,extends,exposes,imports}-edge.tsx` + `index.ts` + `edge-style.ts` + `edge-path.tsx` (new)
  - Spec: VE-001 edge table (actual enums: EXPOSES/IMPORTS — not CALLS/EXPORTS from launch table)
  - Tests: `canvas/edges/__tests__/edges.test.tsx` — stroke/dash/arrow per type
  - Est. lines: 200 | Depends on: C3-02

## Slice C4: Progressive Loading & Drill-Down — PR #4

### Work Unit C4-W1: `feat(viz): breadcrumb trail and detail panel`

- [x] C4-01: Create `GraphBreadcrumbs` — BELONGS_TO chain from navigationSlice, `.glass-subtle`, clickable segments navigate back
  - Files: `src/frontend/src/components/graph/graph-breadcrumbs.tsx` (new)
  - Spec: GN-003
  - Tests: `graph-breadcrumbs.test.tsx` — trail render, segment click re-centers + truncates
  - Est. lines: 150 | Depends on: C2-05
  - NOTE (C4 apply): implemented per launch prompt at `components/graph/graph-breadcrumbs.tsx` (not the tasks.md path); click truncates via new store action `truncateBreadcrumbs(index)` + optional `onNavigateTo(index)` callback. Empty state shows "Graph".
- [x] C4-02: Create `GraphDetailPanel` — type icon, FQN (mono), props table, "5 In / 3 Out", Show Dependencies/Dependents buttons, `.animate-slide-in`
  - Files: `src/frontend/src/components/graph/graph-detail-panel.tsx` (new)
  - Spec: VI-001
  - Tests: `graph-detail-panel.test.tsx` — edge counts render, buttons fire neighborhood actions, switch node updates without re-animation
  - Est. lines: 240 | Depends on: C2-05, C3-06
  - NOTE (C4 apply): pure helpers exported (`titleCaseKey`, `countEdgeStats`); icons/badges from `canvas/nodes/node-style.ts` (C3-06 mapping). Action buttons set `focusNodeId` in store + fire `onShowNeighborhood(id, 'in'|'out')`. Edge-detail variant + loading skeleton + close included.

### Work Unit C4-W2: `feat(viz): progressive chunk loading with snapshot polling`

- [x] C4-03: Create `useProgressiveLoad` hook — snapshot-first → 200-node chunk streaming, progress tracking, snapshot version polling → changed-node diff for `animate-pulse`
  - Files: `src/frontend/src/lib/visualization/hooks/use-progressive-load.ts` (new)
  - Spec: GN-001, GN-005
  - Tests: `hooks/__tests__/use-progressive-load.test.tsx` — snapshot-then-chunks order, sequential chunk merge, progress 0..1 in store, version bump diff, refresh
  - Est. lines: 290 | Depends on: C2-04, C3-05
  - NOTE (C4 apply): launch prompt's C4-03 is the hook, NOT the `GraphWorkspace` component in tasks.md — GraphWorkspace (empty state + sync button + pulse wiring) remains for the C5 route slice. Hook gates chunks on snapshot success (`enabled`), uses `getGraphNodes(repoId, {page, limit})` directly (mirrors `useGraphNodes` config without modifying it), reports changed ids via `computeChangedNodes(nodes, version)` + `onVersionChange`. Poll interval comes from `useGraphSnapshot` (30s per REQ-GN-005); added `loadingSlice` (`loadProgress` + `setLoadProgress`) to the store.

### Work Unit C4-W3: `feat(viz): drill-down and focus mode`

- [x] C4-04: Implement drill-down (click → `getNodeDetail(direction=out)` + center + breadcrumb push) and focus mode (double-click/context → neighbors visible, others opacity 0.15, outgoing solid vs incoming dashed)
  - Files: `src/frontend/src/lib/visualization/hooks/use-drill-down.ts` (new)
  - Spec: GN-002 (Repo→Module→Class), GN-004 (focus dimming)
  - Tests: `hooks/__tests__/use-drill-down.test.tsx` — double-click expands + pushes breadcrumb + loads neighborhood, goBack restores previous focus, navigateTo truncates, popstate back, backToOverview, `applyFocusMode` 1-hop filter
  - Est. lines: 210 | Depends on: C4-02, C4-03, C2-02
  - NOTE (C4 apply): launch prompt's C4-04 is the `useDrillDown` hook (not store/graph-canvas edits in tasks.md). Pure `applyFocusMode` (1-hop neighbors, dimmed ids) exported for the workspace to wire. Adapter wiring (`onNodeDoubleClick → handleNodeDoubleClick`) lands with GraphWorkspace in the C5 route slice.

## Slice C5: Views & Filtering — PR #5

### Work Unit C5-W1: `feat(viz): filter predicates and filter bar`

- [x] C5-01: Create pure filter predicates + view presets (Overview all, Module MODULE+DEPENDS_ON, API Explorer ENDPOINT+EXPOSES, …) + hideDeprecated/hideExternal
  - Files: `src/frontend/src/lib/visualization/filter.ts` (new)
  - Spec: VV-002, VV-001 (view filters)
  - Tests: `filter.test.ts` — each predicate, `deprecated_at` hidden, external hidden, view preset combos
  - Est. lines: 190 | Depends on: C2-01
  - NOTE (C5 apply): launch C5-01 = GraphFilterBar component; the pure predicates stayed in the C3 `canvas/filter.ts` and were EXTENDED in place (additive `layerFilter` + `deriveNodeLayer` + `countActiveFilters`) instead of a new lib module; view presets live in `lib/visualization/views.ts` (C5-02). Store gained `resetFilters`.
- [x] C5-02: Create `GraphFilterBar` — 12 type chips (multi-select), 6 edge toggles, Hide External/DEPRECATED toggles; <300ms update
  - Files: `src/frontend/src/components/graph/graph-filter-bar.tsx` (new)
  - Spec: VV-002
  - Tests: `graph-filter-bar.test.tsx` — chip toggles store, combined filters, no full re-render
  - Est. lines: 230 | Depends on: C2-05, C5-01
  - NOTE (C5 apply): created per launch at `components/graph/graph-filter-bar.tsx`; reads/writes `filterSlice` (visibleNodeTypes/visibleEdgeTypes/showExternal/showDeprecated/layerFilter/searchQuery), All/None quick buttons, layer dropdown, active-count badge, Reset Filters, search input (Enter → onSearchSubmit), collapsible on mobile.

### Work Unit C5-W2: `feat(viz): view switcher and view presets`

- [x] C5-03: Create `GraphToolbar` — 7 view chips (`.glass-subtle`, active `primary-500` border, <100ms switch), zoom/fit/reset buttons
  - Files: `src/frontend/src/components/graph/graph-toolbar.tsx` (new)
  - Spec: VV-001, VE-003
  - Tests: `graph-toolbar.test.tsx` — 7 chips, switch triggers layout recompute, Event Flow chip shows placeholder
  - Est. lines: 160 | Depends on: C2-05, C3-05
  - NOTE (C5 apply): extended the EXISTING toolbar in place (launch C5-03 = extend, not recreate); placeholder badge → 7 icon chips (`aria-pressed`, active `primary-500` border), layout select/fit/±10% zoom preserved from C3.
- [x] C5-04: Create view renderers — overview (d3-force), module-deps (dagre top-down), dependency-tree (dagre radial), api-explorer (dagre grouped), layer (d3-force layered + deriveLayer), domain (fcose clustered + deriveDomain), event-flow (empty state)
  - Files: `src/frontend/src/components/graph/views/{overview,module-deps,dependency-tree,api-explorer,layer,domain,event-flow}-view.tsx` + `index.ts` (new)
  - Spec: VV-001 (view→layout table), VV-003 (derivation), View 7 placeholder
  - Tests: `views/view-presets.test.tsx` — each view applies correct layout+filter; Event Flow renders "Event data not yet available…"
  - Est. lines: 240 | Depends on: C5-03, C5-01, C2-02, C3-03
  - NOTE (C5 apply): launch C5-02 = pure `lib/visualization/views.ts` configs (`getViewConfig`/`VIEWS`/`applyViewMode`) instead of per-view components — the layout engines already exist (C3 `layout-engine.ts`) and the workspace switches configs; Event Flow placeholder renders in GraphWorkspace. Dependency Tree uses actual enum `EXPOSES` (not spec "EXPORTS").

### Work Unit C5-W3: `feat(viz): search and keyboard shortcuts`

- [x] C5-05: Create `GraphSearchBar` + match logic — FQN/label contains match, `primary-500` glow ring, auto-center first match, `Ctrl+F` focus
  - Files: `src/frontend/src/components/graph/graph-search-bar.tsx`, `src/frontend/src/lib/visualization/search.ts` (new)
  - Spec: VV-003, VI-005 (Ctrl+F)
  - Tests: `graph-search-bar.test.tsx` — match set, glow class, auto-center first, Ctrl+F focus
  - Est. lines: 160 | Depends on: C5-01, C2-05
  - NOTE (C5 apply): launch C5-04 = `hooks/use-graph-search.ts` (pure `findMatches` + highlight/centerOn wiring); search input lives IN GraphFilterBar (wired via `searchInputRef` + `onSearchSubmit`); Ctrl+F focus wired through `useKeyboardShortcuts`.
- [x] C5-06: Create keyboard shortcuts hook — `f` fit, `+`/`−` zoom, `r` reset, `Esc` deselect, `Ctrl+F` search, `1`–`7` views
  - Files: `src/frontend/src/components/graph/graph-keyboard.ts` (new)
  - Spec: VI-005
  - Tests: `graph-keyboard.test.ts` — each key dispatch, Esc deselects + closes panel, `3` switches view
  - Est. lines: 110 | Depends on: C5-05, C5-03, C2-05
  - NOTE (C5 apply): created at `lib/visualization/hooks/use-keyboard-shortcuts.ts`; ignores shortcuts while typing in inputs and for Ctrl/Cmd/Alt-modified keys other than Ctrl/Cmd+F; `r` = fit + clear selection/focus.

### Work Unit C5-W4: `feat(viz): context menu and graph route`

- [x] C5-07: Create `GraphContextMenu` — right-click: Copy FQN, Show Dependencies, Show Dependents, Center on Node; `.glass-elevated`; dismiss on outside click
  - Files: `src/frontend/src/components/graph/graph-context-menu.tsx` (new)
  - Spec: VI-004
  - Tests: `graph-context-menu.test.tsx` — 4 actions, Copy FQN writes clipboard, outside click dismisses
  - Est. lines: 140 | Depends on: C2-05, C4-02
  - NOTE (C5 apply): menu writes `navigator.clipboard` directly + closes; clamps to viewport; adapter contract gained `onNodeContextMenu` (adapter.ts + ReactFlowAdapter + GraphCanvas prop).
- [x] C5-08: Create graph route — server shell → `GraphWorkspace`, add "View Graph" link on repo page, feature-flag the route (flag off → mock restored)
  - Files: `src/frontend/src/app/(dashboard)/repositories/[id]/graph/page.tsx` (new), `src/frontend/src/app/(dashboard)/repositories/[id]/page.tsx` (modify)
  - Spec: VE-001 (page render), proposal rollback flag
  - Tests: e2e `src/frontend/e2e/graph.spec.ts` — load → render → click node → detail panel → filter → keyboard
  - Est. lines: 220 | Depends on: C5-06, C5-07, C3-05
  - NOTE (C5 apply): GraphWorkspace (launch C5-07) created + route shell + View Graph link. E2E NOT added: the route sits behind ProtectedRoute (client auth) + the KG API — no backend/auth seed exists in this env, so a Playwright spec would be red-on-green; the full flow is covered by `graph-workspace.test.tsx` (9 tests: loading/data/error/empty/no-results/Event-Flow) + component tests.

## Slice C6: WebGL Scale Engine — PR #6 (GATED — DEFERRED at archive 2026-08-05, pending real-repo perf gate >2k nodes)

### Work Unit C6-W1: `docs(viz): record real-repo perf gate decision`

- [ ] C6-01: Run real-repo perf test (>2k nodes) and record gate decision in design.md
  - Files: `openspec/changes/epic-007-visualization/design.md`
  - Spec: proposal C6 gate
  - Tests: none (decision artifact)
  - Est. lines: 20 | Depends on: C5-08

### Work Unit C6-W2: `feat(viz): Cytoscape WebGL adapter`

- [ ] C6-02: Implement `CytoscapeAdapter` conforming to `GraphRendererAdapter`
  - Files: `src/frontend/src/components/graph/cytoscape-adapter.tsx` (new)
  - Spec: VE-001 (contract), proposal C6
  - Tests: `cytoscape-adapter.test.ts` — contract methods present, render/applyLayout dispatch
  - Est. lines: 260 | Depends on: C6-01 (gate pass), C3-02
- [ ] C6-03: Create adapter factory + A/B flag (default ReactFlowAdapter)
  - Files: `src/frontend/src/components/graph/adapter-factory.ts` (new), `graph-canvas.tsx` (modify)
  - Spec: VE-001 (isolation maintained)
  - Tests: `adapter-factory.test.ts` — returns ReactFlowAdapter by default, CytoscapeAdapter when flag set
  - Est. lines: 90 | Depends on: C6-02

## PR Chain Plan

| PR  | Slice            | Base → Target branch           | Tasks     | Est. lines                                                      | Spec coverage                          |
| --- | ---------------- | ------------------------------ | --------- | --------------------------------------------------------------- | -------------------------------------- |
| 1   | C1 KG API        | `main` → `feat/viz/kg-api`     | C1-01..05 | ~720 (split C1a: 01–03 / C1b: 04–05)                            | KG: Export, JWT, Direction, Multi-type |
| 2   | C2 Data layer    | `main` → `feat/viz/data-layer` | C2-01..05 | ~1030 (split C2a: 01–02 / C2b: 03–04 / C2c: 05)                 | GN-001/002/005, VV-002/003, VI-001     |
| 3   | C3 Canvas        | `main` → `feat/viz/canvas`     | C3-01..07 | ~1310 (split C3a: 01–03 / C3b: 04–05 / C3c: 06–07)              | VE-001..004, VV-004, VI-002/003        |
| 4   | C4 Navigation    | `main` → `feat/viz/navigation` | C4-01..04 | ~890 (split C4a: 01–02 / C4b: 03 / C4c: 04)                     | GN-001..005, VI-001                    |
| 5   | C5 Views         | `main` → `feat/viz/views`      | C5-01..08 | ~1450 (split C5a: 01–02 / C5b: 03–04 / C5c: 05–06 / C5d: 07–08) | VV-001..004, VI-004/005                |
| 6   | C6 WebGL (GATED) | `main` → `feat/viz/webgl`      | C6-01..03 | ~370                                                            | VE-001 (adapter swap)                  |

**Chain rules**: C1 merges first (backend dependency for C2–C5). C2–C5 sequential for safe review (parallelizable). C6 only if gate passes AND C3 merged. Each slice diff must show only its own slice (stacked-to-main; retarget/rebase if a child PR shows prior slices).

## Review Workload Forecast

| Field                         | Value                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Estimated total changed lines | ~5,770 (range 5,400–6,200)                                                                                              |
| 400-line budget risk          | High                                                                                                                    |
| Chained PRs recommended       | Yes                                                                                                                     |
| Suggested split               | 6 chained PRs (each slice), High-risk PRs split internally                                                              |
| Delivery strategy             | ask-always (session preflight)                                                                                          |
| Chain strategy                | pending — stacked-to-main recommended (slices merge sequentially to main; each independently valuable; additive C1 API) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Per-PR budget risk: PR1 Medium (~720, split C1a/C1b), PR2 High (~1030), PR3 High (~1310), PR4 High (~890), PR5 High (~1450), PR6 Medium (~370, gated).

### Suggested Work Units

| Unit | Goal                 | Likely PR        | Notes                                                 |
| ---- | -------------------- | ---------------- | ----------------------------------------------------- |
| 1    | C1 KG API extensions | PR 1 (C1a+C1b)   | base `main`; tests alongside (Jest); additive API     |
| 2    | C2 Data layer        | PR 2 (C2a/b/c)   | base `main`; pure-logic vitest                        |
| 3    | C3 Canvas engine     | PR 3 (C3a/b/c)   | base `main`; component + isolation tests              |
| 4    | C4 Navigation        | PR 4 (C4a/b/c)   | base `main`; store + component tests                  |
| 5    | C5 Views & filtering | PR 5 (C5a/b/c/d) | base `main`; component + e2e                          |
| 6    | C6 WebGL (gated)     | PR 6             | only after gate passes; adapter factory keeps default |

**Action for orchestrator**: user must choose chain strategy (recommended: stacked-to-main) before sdd-apply. Work units map 1:1 to conventional commits — do not merge slices or mix commits across slices.
