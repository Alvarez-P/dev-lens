# visualization-views Specification

> **Archived from**: `epic-007-visualization` (2026-08-05) | **New capability** | Ref: RFC-008 §6, §12

## Purpose

Multiple architectural views exposing the same Knowledge Graph through different lenses — force-directed overview, hierarchical module tree, dependency chains, API grouping, and client-side derivation for Layer and Domain views. All views share a common filter bar and search.

## Views Table

| #   | View                 | Layout             | Node Filter                      | Edge Filter          |
| --- | -------------------- | ------------------ | -------------------------------- | -------------------- |
| 1   | Graph Overview       | d3-force           | All types                        | All types            |
| 2   | Module Dependencies  | dagre (top-down)   | MODULE                           | DEPENDS_ON           |
| 3   | Dependency Tree      | dagre (radial)     | Selected root + deps             | EXPORTS              |
| 4   | API Explorer         | dagre (grouped)    | ENDPOINT + CLASS/MODULE          | EXPOSES + BELONGS_TO |
| 5   | Layer Architecture   | d3-force (layered) | All (derived: layer by filePath) | All                  |
| 6   | Domain Relationships | fcose (clustered)  | All (derived: domain by folder)  | All                  |
| 7   | Event Flow           | **placeholder**    | None                             | None                 |

Views 5–6 SHALL derive layer/domain assignment client-side via `filePath` heuristics: path segment matching (`/infrastructure/`, `/domain/`, `/application/`, `/presentation/`). View 7 SHALL render an empty state: "Event data not yet available — tracking is planned for a future release."

## Requirements

### REQ-VV-001: View Mode Switcher

The system MUST render a view switcher component using styled mode chips (`.glass-subtle`, `text-sm`, `font-medium`). Switching views SHALL trigger layout recomputation and appear instant (<100ms perceived). Active view SHALL use `primary-500` accent border.

**Scenarios:**

- GIVEN the graph is rendered in "Graph Overview" view
- WHEN the user clicks the "Module Dependencies" chip
- THEN the layout recomputes with dagre hierarchical (top-down)
- AND filtered to MODULE nodes + DEPENDS_ON edges
- AND the transition feels instant

### REQ-VV-002: Filter Bar

The system MUST provide: a type-chip selector (one per KG node type, multi-select), an edge-type toggle row, a "Hide External Deps" toggle, and a "Hide Deprecated" toggle. All toggles SHALL trigger <300ms filter updates without full re-render.

**Scenarios:**

- GIVEN a graph with Controller, Service, and Repository nodes
- WHEN the user toggles off "Controller" and "Repository" chips
- THEN only Service nodes remain visible
- AND the layout re-stabilizes within 300ms

- GIVEN "Hide Deprecated" is toggled on
- WHEN filtered nodes have `deprecated_at` set
- THEN deprecated nodes are hidden

### REQ-VV-003: Client-Side Search

The system MUST search visible nodes by FQN or label using a `<Input>` atom (from `src/frontend/src/components/atoms/input.tsx`) with a glass-styled search bar. Matched nodes SHALL highlight with `primary-500` glow ring. First match SHALL auto-center the viewport.

**Scenarios:**

- GIVEN 100 visible nodes
- WHEN the user types "Auth" in the search bar
- THEN nodes with FQN or label containing "Auth" highlight with lime glow
- AND the viewport auto-centers on the first match

### REQ-VV-004: Viewport Culling

The system MUST NOT render nodes outside the viewport. Visible-nodes-only rendering SHALL use React Flow's `onlyRenderVisibleElements` with a 200px margin. This applies to all views.

**Scenarios:**

- GIVEN 500 nodes across a large layout
- WHEN the user zooms to 2x on a specific region
- THEN only nodes within or near (200px margin) the viewport are rendered

## References

- RFC-008 §6 (Visualization Modes), §12 (Integration)
- KG Model spec: node types for filter mapping
- `atoms/input.tsx` for search bar component
- Layer heuristics pattern: see EPIC-006 for path-segment derivation
