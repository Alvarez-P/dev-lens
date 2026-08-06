# Design: EPIC-007 — Visualization

> **Pattern**: Cognitive-doc — answer first, details follow. Component tree maps to DDD bounded contexts.

## Technology Stack

Add: `@xyflow/react` 12.11, `dagre` + `@types/dagre`, `d3-force` + `@types/d3-force` (all MIT).
Existing: Next.js 15.5 (App Router), React 19.2, Zustand 4.5, TanStack Query 5.59, TailwindCSS 3.4.

## Architecture Decisions

| Decision                                             | Rationale                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GraphRendererAdapter` interface isolates React Flow | RFC-008 §5.1: adapter lets C6 swap to Cytoscape.js without rewriting UI layers |
| Zustand with slices over React Context               | Zustand already in use (`useAppStore`); slices prevent re-render cascades      |
| Snapshot-first loading (snapshot → 200-node chunks)  | Prevents 2s+ wait on large repos; first paint within 200 nodes                 |
| dagre for hierarchy, d3-force for mesh, no ELKJS     | All-MIT license; ELKJS EPL/GPL dual blocked per license enforcement spec       |
| Client-side layer/domain derivation via filePath     | Reuses EPIC-006 pattern — no backend changes needed for views 5–6              |
| No multi-select in v1                                | Spec explicitly disables multi-select; simplifies selection store              |

## Data Flow

```
NestJS API ──→ api-client.ts (JWT auto-attach, refresh, error normalization)
                    │
          ┌─────────▼─────────┐
          │  graph-api.ts      │
          │  getSnapshot()     │
          │  getNodes(offset)  │
          │  getExport()       │
          └─────────┬─────────┘
                    │
          ┌─────────▼─────────┐
          │ TanStack Query      │  staleTime: 30s, retry: 1
          │ useGraphSnapshot()  │
          │ useGraphNodes()     │
          └─────────┬─────────┘
                    │
          ┌─────────▼─────────┐
          │ normalize.ts        │  flat arrays → Map<id, Node> + Map<id, Edge> + AdjacencyIndex
          │ deriveLayer()       │  /infrastructure/ → "Infrastructure", /domain/ → "Domain"
          │ deriveDomain()      │  path segment 1 → domain group
          └─────────┬─────────┘
                    │
          ┌─────────▼──────────────┐
          │ Zustand Graph Store     │
          │  selectionSlice         │  selectedNodeId, selectedEdgeId
          │  viewSlice              │  activeView (1–7), layout
          │  filterSlice            │  visibleTypes, edgeTypes, hideDeprecated, hideExternal
          │  navigationSlice        │  breadcrumb stack, focusNodeId, viewport
          └─────────┬──────────────┘
                    │
          ┌─────────▼──────────┐
          │ GraphRendererAdapter │  interface ──→ ReactFlowAdapter (v1)
          │  render(), layout()  │
          │  fitView(), zoom()   │
          └──────────────────────┘
```

## Component Tree

```
app/(dashboard)/repositories/[id]/graph/page.tsx    (Server shell)
└── GraphWorkspace 'use client'
    ├── GraphBreadcrumbs                (BELONGS_TO chain, glass-subtle)
    ├── GraphToolbar                    (view chips, fit/zoom/reset btns)
    ├── GraphFilterBar                  (type chips ×12, edge toggles ×6, hide-toggles)
    ├── GraphCanvas                     (flex-1, relative)
    │   └── GraphRendererAdapter (iface)
    │       └── ReactFlowAdapter        (onlyRenderVisibleElements, 200px margin)
    │           ├── CustomNode×12       (one per NodeType enum value)
    │           ├── CustomEdge×6        (one per EdgeType enum value)
    │           ├── MiniMap             (bottom-left, 160×120, glass)
    │           ├── Controls            (zoom, fit, lock)
    │           └── Background          (bg-surface-950, grid pattern)
    ├── GraphDetailPanel               (w-80, glass-elevated, slide-in)
    └── GraphContextMenu               (glass-elevated, 4 actions)
```

## Node/Edge Visual Mapping

Based on **actual enums** (`NodeType`, `EdgeType`) — NOT spec labels. Hex colors from tailwind config:

| NodeType            | Shape            | Accent        | Icon (lucide-react) |
| ------------------- | ---------------- | ------------- | ------------------- |
| PROJECT             | Diamond          | `primary-500` | `FolderGit2`        |
| PACKAGE             | Rounded rect     | `surface-300` | `Package`           |
| MODULE              | Folder           | `primary-400` | `Folder`            |
| CONTROLLER          | Hexagon          | `warning-400` | `Route`             |
| SERVICE             | Rectangle        | `success-400` | `Cog`               |
| REPOSITORY          | Cylinder         | `surface-200` | `Database`          |
| ENTITY              | Rounded rect     | `surface-300` | `Layers`            |
| DTO                 | Pentagon         | `surface-400` | `FileCode`          |
| INTERFACE           | Circle           | `primary-400` | `Puzzle`            |
| ENDPOINT            | Chevron          | `primary-300` | `Link2`             |
| EXTERNAL_DEPENDENCY | Cloud            | `surface-500` | `Cloud`             |
| UNKNOWN             | Diamond (dashed) | `error-400`   | `HelpCircle`        |

| EdgeType   | Style                | Color         |
| ---------- | -------------------- | ------------- |
| BELONGS_TO | Thin solid, no arrow | `surface-500` |
| DEPENDS_ON | Solid + arrow        | `surface-300` |
| IMPLEMENTS | Dashed + arrow       | `success-400` |
| EXTENDS    | Solid + arrow        | `primary-400` |
| EXPOSES    | Dotted + arrow       | `warning-400` |
| IMPORTS    | Dashed, no arrow     | `surface-500` |

## View → Layout Mapping

| View               | Layout           | Node Filter             | Edge Filter          |
| ------------------ | ---------------- | ----------------------- | -------------------- |
| 1. Overview        | d3-force         | All                     | All                  |
| 2. Module Deps     | dagre top-down   | MODULE                  | DEPENDS_ON           |
| 3. Dependency Tree | dagre radial     | Root + deps             | EXPORTS              |
| 4. API Explorer    | dagre grouped    | ENDPOINT + CLASS/MODULE | EXPOSES + BELONGS_TO |
| 5. Layer Arch      | d3-force layered | All (derived layer)     | All                  |
| 6. Domain Rel      | fcose clustered  | All (derived domain)    | All                  |
| 7. Event Flow      | N/A              | Empty state             | Empty state          |

## GraphRendererAdapter Contract

```typescript
interface GraphRendererAdapter {
  render(nodes: GraphNode[], edges: GraphEdge[], layout: LayoutType): void;
  applyLayout(layout: LayoutType): void;
  highlight(nodeIds: string[]): void;
  clearHighlights(): void;
  fitView(padding?: number): void;
  zoomIn(step?: number): void;
  zoomOut(step?: number): void;
  zoomTo(level: number): void;
  resetView(): void;
  getViewport(): Viewport;
  setViewport(v: Viewport): void;
  centerOn(nodeId: string, zoom?: number): void;
  onNodeClick(handler: (nodeId: string) => void): void;
  onNodeDoubleClick(handler: (nodeId: string) => void): void;
  onEdgeClick(handler: (edgeId: string) => void): void;
  onPaneClick(handler: () => void): void;
  onViewportChange(handler: (v: Viewport) => void): void;
  dispose(): void;
}
```

## Backend Changes (C1)

Modify `graph.controller.ts`:

- Add `@UseGuards(JwtAuthGuard, RepoMembershipGuard)` at controller level
- `GET /:repoId/export` → new method: `findAllNodesAndEdges()` bypasses pagination
- `GET /:repoId/nodes` → `type` param accepts `string[]` (backward-compat with `string`)
- `GET /:repoId/nodes/:fqn` → add `direction` query param ('in' | 'out' | 'both')

Modify `graph-query.dto.ts`:

- `GraphNodesQueryDto.type`: change `@IsIn(...)` validator to accept array + backward compat
- New `GraphExportQueryDto`: `@IsOptional() version?: number`
- New `GraphQueryNodeDetailDto`: `@IsOptional() direction?: 'in' | 'out' | 'both'`

New `graph-query.service.ts` methods:

- `findAllNodesAndEdges(repoId, version?)` → returns `{nodes: GraphNode[], edges: GraphEdge[]}`

## File Changes

| File                                                                | Action | Purpose                                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `src/frontend/src/lib/visualization/types.ts`                       | Create | GraphNode, GraphEdge, GraphSnapshot, NormalizedGraph, AdjacencyIndex TS types |
| `src/frontend/src/lib/visualization/graph-api.ts`                   | Create | API functions: getSnapshot, getNodes, getNodeDetail, getExport                |
| `src/frontend/src/lib/visualization/normalize.ts`                   | Create | Flat → normalized, adjacency index, path derivation                           |
| `src/frontend/src/lib/visualization/hooks/use-*.ts`                 | Create | TanStack Query hooks: useGraphSnapshot, useGraphNodes, useGraphExport         |
| `src/frontend/src/lib/store/use-graph-store.ts`                     | Create | Zustand: selection, view, filter, navigation slices                           |
| `src/frontend/src/components/graph/graph-renderer-adapter.ts`       | Create | TypeScript interface for renderer abstraction                                 |
| `src/frontend/src/components/graph/react-flow-adapter.tsx`          | Create | React Flow implementation + custom node/edge reg                              |
| `src/frontend/src/components/graph/nodes/*.tsx`                     | Create | 12 custom node components                                                     |
| `src/frontend/src/components/graph/edges/*.tsx`                     | Create | 6 custom edge components                                                      |
| `src/frontend/src/components/graph/layouts/*.ts`                    | Create | Layout engines: dagre, d3-force, fcose wrappers                               |
| `src/frontend/src/components/graph/graph-canvas.tsx`                | Create | Wraps adapter, provides ReactFlowProvider                                     |
| `src/frontend/src/components/graph/graph-workspace.tsx`             | Create | Orchestrator: toolbar + filter + canvas + detail panel                        |
| `src/frontend/src/components/graph/graph-toolbar.tsx`               | Create | View chips, zoom/fit/reset controls                                           |
| `src/frontend/src/components/graph/graph-filter-bar.tsx`            | Create | Type chips, edge toggles, hide-toggles                                        |
| `src/frontend/src/components/graph/graph-breadcrumbs.tsx`           | Create | BELONGS_TO breadcrumb trail                                                   |
| `src/frontend/src/components/graph/graph-detail-panel.tsx`          | Create | Right panel: type icon, FQN, props, edge counts                               |
| `src/frontend/src/components/graph/graph-context-menu.tsx`          | Create | Right-click: Copy FQN, Dependencies, Dependents, Center                       |
| `src/frontend/src/app/(dashboard)/repositories/[id]/graph/page.tsx` | Create | Route: server shell → GraphWorkspace client                                   |
| `src/frontend/src/app/(dashboard)/repositories/[id]/page.tsx`       | Modify | Add "View Graph" link                                                         |
| `src/backend/.../graph.controller.ts`                               | Modify | Export, multi-type, direction, JWT guard                                      |
| `src/backend/.../graph-query.dto.ts`                                | Modify | Multi-type validation, new DTOs                                               |
| `src/backend/.../graph-query.service.ts`                            | Modify | findAllNodesAndEdges method                                                   |
| `src/frontend/package.json`                                         | Modify | Add @xyflow/react, dagre, d3-force, @types/*                                  |

## Testing Strategy

| Layer       | What                                                                               | Tool                           | Priority |
| ----------- | ---------------------------------------------------------------------------------- | ------------------------------ | -------- |
| Unit        | normalize.ts, adjacency, deriveLayer/Domain, filter predicates, DTO validation     | vitest (jsdom)                 | First    |
| Unit        | Zustand store slices (selection, view, filter, navigation)                         | vitest                         | First    |
| Component   | GraphToolbar, GraphFilterBar, GraphBreadcrumbs, GraphDetailPanel (no canvas)       | vitest + testing-library/react | Second   |
| Component   | CustomNode components (DOM rendering, not canvas)                                  | vitest + testing-library/react | Second   |
| E2E         | Full flow: load → render → click node → detail panel → filter → keyboard shortcuts | Playwright (chromium)          | Third    |
| Integration | Backend: JWT guard, export endpoint, multi-type filter, direction param            | jest + supertest               | First    |

## Open Questions

- [ ] Where is `RepoMembershipGuard` defined? (needed for JWT guard — may need to import from org/repo module)
- [ ] Does `GraphRepository` support `findAllNodesAndEdges` bypassing pagination, or must we add it?
- [ ] Feature flag: where is the feature-flag system configured? (proposal mentions flagging `/graph` route)
