# Design: Request-Flow Visualization

## Technical Approach

Extract NestJS lifecycle decorators (`@UseGuards`, `@UsePipes`, `@UseInterceptors`), parameter type annotations, and constructor injection from the TypeScript AST via ts-morph. New IR fields feed four additional node types and edge types in the semantic model. A `GET /graph/:repoId/endpoints/:fqn/flow` endpoint traverses the graph to assemble ordered lifecycle steps. The frontend renders a REQUEST_FLOW view with SVG-direct token animation driven by click-to-play.

## Architecture Decisions

| Decision                                                 | Choice                                                                                                                | Rationale                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AST extraction strategy                                  | Deterministic only: class references (`@UseGuards(AuthGuard)`) — no factory calls, no `APP_GUARD` module providers    | Spec requires never guessing; unsupported forms silently omitted                                    |
| Lifecycle data in IR vs. raw AST                         | New `IrEndpoint.lifecycle`, `IrEndpoint.typedParams`, `IrClass.injectedDependencies` fields on existing value objects | Keeps IR as the contract between parser and graph builder; avoids AST leakage                       |
| Flow query: graph traversal vs. pre-baked endpoint field | Graph traversal — the `/flow` endpoint queries PROTECTS/TRANSFORMS/INVOKES edges + INJECTS for service tail           | Mirrors relationship data already persisted; no new storage; approximate tail derived at query time |
| Old snapshot compatibility                               | Version check: if snapshot version < 4 (FLOW_MIN_VERSION), return `flowAvailable: false`                              | No data fabrication; re-analysis required                                                           |
| Token animation                                          | SVG-direct: `requestAnimationFrame` + `path.getPointAtLength()` mutating `<g>` element directly                       | Zero per-frame React re-renders; guaranteed 60fps                                                   |
| Flow layout                                              | Top-to-bottom pipeline: guards → pipes → interceptor → handler → services, positioned manually                        | Not force-directed; pipeline is deterministic — no layout engine needed                             |

## Data Flow

```
Parser (ts-morph) → IR (lifecycle/typedParams/injectedDependencies)
    → SemanticModelBuilder (Guard/Pipe/Interceptor/Middleware nodes + PROTECTS/TRANSFORMS/INVOKES/INJECTS edges)
    → GraphRepository (jsonb properties, varchar type — additive, no migration)
    → GraphQueryService.getEndpointFlow() (graph traversal)
    → GET /graph/:repoId/endpoints/:fqn/flow
    → Frontend flowSlice (Zustand) → TokenAnimation (rAF SVG)
```

Old snapshots: version check → `{ flowAvailable: false }` → empty state "Re-analyze to enable flow visualization."

## File Changes

| File                                                                  | Action | Description                                                                                                          |
| --------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `analysis/domain/ir-nodes.ts`                                         | Modify | Add `lifecycle`, `typedParams` to `IrEndpointProps`/`IrEndpoint`; `injectedDependencies` to `IrClassProps`/`IrClass` |
| `analysis/infrastructure/parsers/typescript/typescript-parser.ts`     | Modify | Extract method-level decorators, param types, constructor injection from AST                                         |
| `analysis/infrastructure/parsers/typescript/typescript-ir-builder.ts` | Modify | Populate new IR fields from parser output                                                                            |
| `knowledge-graph/domain/node-type.enum.ts`                            | Modify | Add Guard, Pipe, Interceptor, Middleware                                                                             |
| `knowledge-graph/domain/edge-type.enum.ts`                            | Modify | Add PROTECTS, TRANSFORMS, INVOKES, INJECTS                                                                           |
| `knowledge-graph/application/semantic-model.builder.ts`               | Modify | Create lifecycle nodes + edges from IR fields                                                                        |
| `knowledge-graph/application/graph-query.service.ts`                  | Modify | Add `getEndpointFlow()`: traverse graph, assemble ordered steps                                                      |
| `knowledge-graph/infrastructure/controllers/graph.controller.ts`      | Modify | Add `GET /:repoId/endpoints/:fqn/flow` endpoint                                                                      |
| `knowledge-graph/infrastructure/controllers/graph-query.dto.ts`       | Modify | Add `EndpointFlowQueryDto`, `FlowResponseDto`                                                                        |
| `frontend/lib/visualization/types.ts`                                 | Modify | Mirror expanded enums; add `FlowStep`, `EndpointFlowResponse`                                                        |
| `frontend/lib/visualization/views.ts`                                 | Modify | Add REQUEST_FLOW view config (mode 8)                                                                                |
| `frontend/lib/visualization/graph-api.ts`                             | Modify | Add `getEndpointFlow()` client function                                                                              |
| `frontend/lib/visualization/store/graph-store.ts`                     | Modify | Add `FlowSlice` (activeEndpointFqn, flowSteps, currentStepIndex, isPlaying, animationSpeed + actions)                |
| `frontend/components/graph/canvas/edges/`                             | Create | New edge components for PROTECTS, TRANSFORMS, INVOKES, INJECTS                                                       |
| `frontend/components/graph/canvas/nodes/`                             | Create | New node components for Guard, Pipe, Interceptor, Middleware                                                         |
| `frontend/components/graph/canvas/edges/edge-path.tsx`                | Modify | Support dashed style for approximate edges; optional token child element                                             |
| `frontend/components/graph/flow/request-flow-canvas.tsx`              | Create | Pipeline layout canvas for REQUEST_FLOW view                                                                         |
| `frontend/components/graph/flow/token-animation.ts`                   | Create | rAF-based SVG token animation (no React state per frame)                                                             |
| `frontend/components/graph/flow/flow-control-bar.tsx`                 | Create | Play/pause/reset controls                                                                                            |
| `frontend/components/graph/graph-workspace.tsx`                       | Modify | Route REQUEST_FLOW view to RequestFlowCanvas; handle `flowAvailable: false`                                          |

## Component Tree

```
GraphWorkspace
├── GraphToolbar (view switcher: +REQUEST_FLOW chip)
├── GraphFilterBar
└── [REQUEST_FLOW mode]
    ├── RequestFlowCanvas
    │   ├── FlowNode (per lifecycle step)
    │   ├── FlowEdge (with dashed style for approximate)
    │   └── TokenAnimation (attached to FlowEdge, SVG-direct)
    └── FlowControlBar
        ├── Play/Pause button
        ├── Step indicator ("3 / 7")
        └── Speed selector (1x, 2x)
```

The adapter isolation boundary (VE-001) is preserved: `RequestFlowCanvas` does NOT import from `@xyflow/react` directly. It manages its own SVG layout since flow is a pipeline, not a free-form graph.

## Performance Considerations

- **Token animation**: Uses `requestAnimationFrame` + direct SVG element mutation (`getPointAtLength()`, `translate` on `<g>`). No `setState` per frame — zero React reconciliation cost.
- **Flow endpoint response size**: Returns only the endpoint's lifecycle chain (typically <20 steps). Not paginated; payload < 5KB.
- **Layout computation**: Pipeline is fixed top-to-bottom with pre-computed positions; no force simulation. New flow nodes are laid out at render time in a single pass.
- **Viewport culling**: REQ-VV-004 applies — off-screen flow edges/nodes are hidden via `onlyRenderVisibleElements`.

## Open Questions

- [ ] Confirm exact `FLOW_MIN_VERSION` value (likely 4, matching the next version bump after this change)
