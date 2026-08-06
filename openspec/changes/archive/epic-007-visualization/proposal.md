# Proposal: EPIC-007 — Visualization

## Intent

Turn the Knowledge Graph into DevLens' primary interface: users explore architecture through interactive graphs instead of file trees (RFC-008 "Visual First"). Currently greenfield — no graph library installed; repo detail page is mock. Scope: v1 interactive exploration (progressive loading, <2k visible nodes), architected for a future WebGL scale upgrade.

## Scope

**In** (C1–C5, C6 gated): KG API extensions, frontend data layer, canvas engine, drill-down navigation, 7 views + filtering, interaction (inspection, search, keyboard).
**Out**: AI interactions, diagram export, collaborative editing, annotation, scoring (per EPIC-007). Event Flow view = explicit placeholder (no event data in graph). WebGL engine deferred to C6.

## Capabilities

### New Capabilities

- `visualization-engine`: renderer adapter (RFC-008 §5.1), React Flow 12 canvas, layouts, progressive loading
- `graph-navigation`: drill-down, breadcrumbs, focus mode, back navigation
- `visualization-views`: Overview/Module/Dependency/Domain/Layer/API views + filter bar
- `visualization-interaction`: node/edge inspection, detail panel, search integration, keyboard shortcuts

### Modified Capabilities

- `knowledge-graph-query-api`: add export endpoint, multi-type filter, neighborhood direction param, JWT guard

## Approach

React Flow 12.11 (MIT, React 19-native) behind a `GraphRendererAdapter` abstraction (RFC-008 §5.1) so WebGL (Cytoscape.js) can replace it without touching interaction/data layers. C1 backend extensions first. Progressive loading keeps visible nodes <2k. Domain/Layer views derived client-side via filePath heuristics (EPIC-006 pattern). All-MIT stack: dagre (hierarchy) + d3-force (mesh) + fcose (clustered); ELKJS deferred (EPL/GPL dual).

## Open Decisions

- **10k+ full-repo rendering** → C6, gated on real-repo performance testing (decision gate before build)
- **Domain/Layer/Event views** → client-side derivation via filePath heuristics; Event Flow is placeholder
- **License** → all-MIT stack; ELKJS excluded

## Affected Areas

| Area                                              | Impact   | Description                                  |
| ------------------------------------------------- | -------- | -------------------------------------------- |
| `src/backend/src/modules/knowledge-graph/`        | Modified | C1: export, multi-type, direction, JWT guard |
| `src/frontend/src/lib/visualization/`             | New      | Data layer: types, normalize, adjacency      |
| `src/frontend/src/components/graph/`              | New      | Canvas, views, interaction                   |
| `src/frontend/src/app/(app)/repositories/*/graph` | New      | Graph page (currently mock)                  |

## Risks

| Risk                            | Likelihood | Mitigation                                 |
| ------------------------------- | ---------- | ------------------------------------------ |
| React Flow ceiling ~1-2k nodes  | Med        | Progressive loading; adapter isolates swap |
| No JWT guard on GraphController | Med        | C1 adds guard + repo-membership check      |
| jsdom can't test canvas/WebGL   | High       | Pure-logic unit tests; Playwright e2e      |
| Repo pages mock — no real graph | High       | Empty state: "no graph yet, sync first"    |

## Rollback Plan

- **Feature flag** `graph` route; flag off → mock page restored
- C1 API additions are additive; revert = remove endpoints, keep JWT guard
- Remove React Flow dep; adapter keeps UI code compile-safe

## Dependencies

- EPIC-001, EPIC-002, EPIC-005, EPIC-006 (completed) — RFC-007 §9 API, RFC-008, RFC-002

## Slice Plan

| #   | Slice                            | Finish condition                                                              |
| --- | -------------------------------- | ----------------------------------------------------------------------------- |
| C1  | KG API extensions                | Export endpoint, multi-type, direction, JWT guard tested                      |
| C2  | Frontend data layer              | Types, hooks, normalize + adjacency; pure-logic unit tested                   |
| C3  | Canvas engine                    | Adapter + React Flow rendering, layouts, zoom/pan/select                      |
| C4  | Progressive loading & drill-down | Breadcrumbs, detail panel, snapshot caching                                   |
| C5  | Views & filtering                | 7 views (Event Flow placeholder), filter bar, search, keyboard, context menus |
| C6  | WebGL scale engine (gated)       | Cytoscape adapter only after real-repo perf test >2k                          |

## Success Criteria

- [ ] Graph page renders a real repo's KG at 1000 nodes: first paint <2s, pan/zoom 60 FPS
- [ ] Filtering updates visualization without full re-render
- [ ] Node selection shows detail panel with related info
- [ ] Drill-down works across levels (Repo→Module→Class)
- [ ] Visualization consumes only the KG API (no direct DB access)
