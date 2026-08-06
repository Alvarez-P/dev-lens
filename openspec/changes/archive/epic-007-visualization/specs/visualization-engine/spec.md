# visualization-engine Specification

> **New capability** | EPIC-007 | Ref: RFC-008 §5.1, §7, §10, §13

## Purpose

Framework-agnostic canvas engine rendering the Knowledge Graph as an interactive visualization. Built on React Flow 12.11 behind a `GraphRendererAdapter` abstraction to isolate rendering tech. Targets dark-theme-only v1, progressive loading, 60 FPS pan/zoom.

## Node Type Visual Mapping

MUST map each KG node type to distinct visual properties per the dark theme + design tokens (Tailwind `primary` scale for lime accent, `surface` scale, `--color-accent`):

| Node Type          | Shape            | Color Ref               | Icon      |
| ------------------ | ---------------- | ----------------------- | --------- |
| Project            | Diamond          | `primary-500` (#caff3a) | repo      |
| Package            | Rounded rect     | `surface-300`           | package   |
| Module             | Folder           | `primary-400` (#d6ff2e) | folder    |
| Controller         | Hexagon          | `warning-400`           | http      |
| Service            | Rectangle        | `success-400`           | service   |
| Repository         | Cylinder         | `surface-200`           | database  |
| Entity             | Rounded rect     | `surface-300`           | entity    |
| DTO                | Pentagon         | `surface-400`           | dto       |
| Interface          | Circle           | `primary-400`           | interface |
| Endpoint           | Chevron          | `primary-300`           | endpoint  |
| ExternalDependency | Cloud            | `surface-500`           | external  |
| Unknown            | Diamond (dashed) | `error-400`             | unknown   |

## Edge Type Visual Mapping

| Edge Type  | Style                | Color Ref     |
| ---------- | -------------------- | ------------- |
| BELONGS_TO | Thin solid, no arrow | `surface-500` |
| DEPENDS_ON | Solid with arrow     | `surface-300` |
| IMPLEMENTS | Dashed with arrow    | `success-400` |
| EXTENDS    | Solid with arrow     | `primary-400` |
| EXPOSES    | Dotted with arrow    | `warning-400` |
| IMPORTS    | Dashed               | `surface-500` |

## Requirements

### REQ-VE-001: Renderer Adapter

The system MUST implement a `GraphRendererAdapter` interface isolating React Flow from interaction/data layers. Direct imports from `@xyflow/react` outside the adapter SHALL NOT exist.

**Scenarios:**

- GIVEN an adapter interface with `render(nodes, edges, options)` and `applyLayout(algorithm)`
- WHEN the adapter is instantiated with React Flow 12.11
- THEN nodes render on a dark (`bg-surface-950`) canvas via `<ReactFlow>`
- AND pan at 60 FPS for ≤2000 visible nodes per RFC-008 §13

- GIVEN only visible elements (`onlyRenderVisibleElements` enabled)
- WHEN the user pans rapidly
- THEN edges outside the viewport are hidden
- AND re-rendered on pan stop within one frame

### REQ-VE-002: Layout Engine Integration

The system MUST integrate dagre (hierarchical) for tree-like graphs and d3-force (force-directed) for mesh networks. fcose MAY be used for clustered layouts. Layout selection SHALL be automatic based on view mode.

**Scenarios:**

- GIVEN a Module Dependencies view (BELONGS_TO hierarchy)
- WHEN the view renders
- THEN dagre produces a top-to-bottom layered layout
- AND node overlap is prevented

- GIVEN a Graph Overview view with mixed node types
- WHEN the view renders
- THEN d3-force produces a force-directed layout
- AND disconnected clusters are visually separated

### REQ-VE-003: Viewport Controls

The system MUST provide zoom (scroll wheel, ±10% step, range 0.1x–4x), pan (click-drag), minimap (bottom-left, 160×120px glass surface), and fit-view button. Dark theme only.

**Scenarios:**

- GIVEN the graph is rendered
- WHEN the user scrolls up
- THEN zoom increases by 10% per tick
- WHEN the user clicks the fit-view button or presses `f`
- THEN all nodes fit in the viewport

### REQ-VE-004: Performance

The system MUST render first paint within 2s for 1000 nodes (progressive), maintain 60 FPS during pan/zoom, and cull off-screen nodes. MUST NOT load ELKJS or any non-MIT library.

**Scenarios:**

- GIVEN a repository with 1000 KG nodes
- WHEN the graph page loads
- THEN first meaningful paint occurs within 2s

- GIVEN a viewport showing a 2000-node neighborhood region
- WHEN an ELKJS import is present in any visualization file
- THEN the build SHALL fail (license enforcement)

## References

- RFC-008 §5.1 (Adapter), §7 (Rendering Tech), §10 (Layouts), §13 (Performance)
- Tailwind config: `src/frontend/tailwind.config.ts` — `primary`, `surface`, semantic color scales
- globals.css: `.glass`, `.glass-elevated`, `--color-accent`
