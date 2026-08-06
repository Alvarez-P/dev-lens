# graph-navigation Specification

> **New capability** | EPIC-007 | Ref: RFC-008 §4, §8

## Purpose

Progressive drill-down exploration across abstraction levels — from Repository down to individual Methods/Endpoints — using snapshot-first loading, expand-on-demand neighborhoods, breadcrumb trails, and focus mode. Enables understanding architecture by traversing it, not reading about it.

## Requirements

### REQ-GN-001: Snapshot-First Loading

The system MUST fetch a snapshot summary before nodes: `GET /api/v1/graph/:repoId/snapshot` returning `{ id, nodeCount, edgeCount, version, status }`. Nodes SHALL load in progressive chunks of 200 via `GET /api/v1/graph/:repoId/nodes?limit=200&offset=N`.

**Scenarios:**

- GIVEN a repo with graph version 3 (5000 nodes)
- WHEN the graph page mounts
- THEN a snapshot summary is fetched first
- AND the first chunk of 200 nodes renders immediately
- AND subsequent chunks stream in as they arrive

- GIVEN a repo with no graph data
- WHEN the graph page mounts
- THEN an empty state renders: "No graph data yet — sync this repository first"
- AND a sync action button is shown

### REQ-GN-002: Drill-Down Navigation

The system MUST support progressive drill-down: Repo → Package → Module → Class/Interface → Method/Endpoint. Each level SHALL be reached by clicking a node, which triggers neighborhood loading and viewport re-centering.

**Scenarios:**

- GIVEN a Module node is displayed
- WHEN the user clicks the Module node
- THEN the view centers on that Module
- AND child nodes (Classes, Interfaces, Services) load via `GET /api/v1/graph/:repoId/nodes/:fqn?direction=out`
- AND a breadcrumb reads "my-repo > my-pkg > AuthModule"

### REQ-GN-003: Breadcrumb Trail

The system MUST render a `BELONGS_TO` chain breadcrumb above the graph viewport. Each segment SHALL be clickable for back-navigation. The breadcrumb container SHALL use `.glass-subtle` (Tailwind `bg-white/[0.03] backdrop-blur-md`).

**Scenarios:**

- GIVEN current focus is on a Class node at depth 4
- WHEN the breadcrumb shows "Repo > pkg > Module > MyService"
- THEN clicking "Module" navigates the viewport back to that Module
- AND the breadcrumb updates to "Repo > pkg > Module"

### REQ-GN-004: Focus Mode

The system MUST support centering on a single node showing only its direct neighborhood. Outgoing and incoming edges SHALL be visually distinct (solid vs. dashed). Non-neighbor nodes SHALL be dimmed (opacity 0.15).

**Scenarios:**

- GIVEN a node with 3 outgoing and 2 incoming edges
- WHEN the user double-clicks or selects "Focus" from the context menu
- THEN only that node + 5 neighbor nodes are fully visible
- AND all other nodes fade to opacity 0.15

### REQ-GN-005: Viewport State & Incremental Refresh

The system MUST persist zoom and pan position across navigation steps within a session. The snapshot version SHALL be polled every 30s; on version change, changed nodes SHALL highlight briefly (2s pulse animation via `animate-pulse`).

**Scenarios:**

- GIVEN viewport at zoom 1.5x, centered on a Module
- WHEN the user drill-downs to a Class within that Module
- THEN the viewport transitions to center on the Class at the same zoom level

- GIVEN snapshot version 3 is displayed
- WHEN the poll detects version 4
- THEN nodes that changed between versions pulse with `primary-500` glow for 2s

## References

- RFC-008 §4 (Non-goals), §8 (Progressive Loading)
- KG Query API: `knowledge-graph-query-api` spec (epic-007 delta for export/chunk endpoints)
- Design tokens: `.glass-subtle`, `bg-surface-950`, `animate-pulse`
