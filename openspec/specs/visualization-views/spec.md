# visualization-views Specification

> **Archived from**: `epic-007-visualization` (2026-08-05) | **New capability** | Ref: RFC-008 §6, §12
> **Updated by**: `request-flow-visualization` (2026-08-10) — REQUEST_FLOW view (#8), flow store slice, token animation, approximate service tail, old-snapshot compatibility (REQ-VV-005..010)

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
| 8   | Request Flow         | flow canvas        | ENDPOINT (click-to-select)       | Lifecycle + DI edges |

Views 5–6 SHALL derive layer/domain assignment client-side via `filePath` heuristics: path segment matching (`/infrastructure/`, `/domain/`, `/application/`, `/presentation/`). View 7 SHALL render an empty state: "Event data not yet available — tracking is planned for a future release." View 8 SHALL render an interactive flow canvas that replaces the standard graph layout and prompts the user to select an endpoint; clicking an endpoint plays its request lifecycle (see REQ-VV-005..010).

## Requirements

### REQ-VV-001: View Mode Switcher

The system MUST render a view switcher component using styled mode chips (`.glass-subtle`, `text-sm`, `font-medium`). Switching views SHALL trigger layout recomputation and appear instant (<100ms perceived). Active view SHALL use `primary-500` accent border. The view switcher SHALL include the `REQUEST_FLOW` chip as the 8th option.

**Scenarios:**

- GIVEN the graph is rendered in "Graph Overview" view
- WHEN the user clicks the "Module Dependencies" chip
- THEN the layout recomputes with dagre hierarchical (top-down)
- AND filtered to MODULE nodes + DEPENDS_ON edges
- AND the transition feels instant

- GIVEN the view switcher with 8 chips
- WHEN the user clicks "Request Flow"
- THEN the canvas transitions to the flow view
- AND displays the endpoint-selection prompt

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

### REQ-VV-005: Request Flow View Mode

The system SHALL provide a `REQUEST_FLOW` view (`ViewMode.REQUEST_FLOW`) as view #8 in the view switcher. Selecting it SHALL render an interactive flow canvas replacing the standard graph layout. The view SHALL initially display a prompt: "Select an endpoint to visualize its request flow." The `EVENT_FLOW` view (#7) SHALL remain untouched — its placeholder state and `isEmptyState: true` configuration are preserved.

#### Scenario: User switches to Request Flow view

- GIVEN the graph is loaded in any view
- WHEN the user clicks the "Request Flow" view chip
- THEN the canvas transitions to the flow view
- AND displays the endpoint-selection prompt

#### Scenario: EVENT_FLOW view unchanged

- GIVEN the EVENT_FLOW placeholder view exists as #7
- WHEN REQUEST_FLOW is added as #8
- THEN EVENT_FLOW's `isEmptyState: true` and "Event data not yet available" message are unchanged

### REQ-VV-006: Endpoint Click → Flow Data Fetch

When the user clicks an endpoint node in the REQUEST_FLOW view, the system SHALL fetch flow data via `GET /api/v1/graph/:repoId/endpoints/:fqn/flow`. The response SHALL contain ordered lifecycle steps with `kind`, `classRef`, and `payloadType` (DTO type annotation from `typedParams`). Service steps beyond the controller handler SHALL carry `approximate: true`.

#### Scenario: Click fetches flow data

- GIVEN the REQUEST_FLOW view is active
- WHEN the user clicks an endpoint node
- THEN `getEndpointFlow(repoId, fqn)` is called
- AND the flow data populates the flow state slice

#### Scenario: Clicking different endpoint replaces flow

- GIVEN flow data is loaded for endpoint A
- WHEN the user clicks endpoint B
- THEN the previous flow state is replaced with endpoint B's data

#### Scenario: Click on non-endpoint node ignored in flow view

- GIVEN the REQUEST_FLOW view is active
- WHEN the user clicks a Controller or Service node
- THEN no flow data is fetched
- AND the existing prompt or loaded flow persists unchanged

### REQ-VV-007: Token Animation Along Edge Paths

The system SHALL animate a visual token along lifecycle step edges using SVG-direct animation (`requestAnimationFrame` + `SVGPathElement.getPointAtLength()`). The token SHALL be a small `<circle>` (or custom SVG shape) mutated directly on the DOM `<g>` element. The token SHALL carry a DTO type label when `payloadType` is present. The animation MUST NOT trigger per-frame React re-renders — token position SHALL be mutated via direct DOM manipulation. Animation SHALL respect `onlyRenderVisibleElements` culling.

#### Scenario: Token travels sequential lifecycle steps

- GIVEN flow data with 5 lifecycle steps (middleware → guard → pipe → handler → service)
- WHEN the animation starts
- THEN a token circle travels along the edge from step 1 to step 2
- THEN step 2 to step 3, sequentially through step 5
- AND each edge displays the DTO type name on the token when `payloadType` is set

#### Scenario: Animation maintains 60fps with culling

- GIVEN 500+ nodes in the graph
- WHEN token animation runs with `onlyRenderVisibleElements` active
- THEN the canvas maintains ~60fps
- AND no per-frame React re-renders are triggered by token position updates

#### Scenario: Approximate edges render with dashed stroke

- GIVEN a lifecycle step with `approximate: true` (service tail)
- WHEN the token travels along its edge
- THEN the edge renders with a dashed stroke pattern
- AND the step node shows an "(approx)" muted badge

### REQ-VV-008: Flow State Store Slice

The Zustand graph store SHALL include a `flowSlice` with state: `activeEndpointFqn` (string | null), `flowSteps` (`RequestFlowStep[]`), `currentStepIndex` (number), `isPlaying` (boolean), `animationSpeed` (1x default). Actions: `startFlow(fqn, steps)`, `nextStep()`, `pauseFlow()`, `resetFlow()`. Switching away from REQUEST_FLOW view or navigating SHALL call `resetFlow()`.

#### Scenario: startFlow populates slice

- GIVEN the user clicks an endpoint and flow data is fetched
- WHEN `startFlow(fqn, steps)` is called
- THEN `activeEndpointFqn` is set, `flowSteps` populated, `currentStepIndex` is 0, `isPlaying` is true

#### Scenario: resetFlow clears on view switch

- GIVEN a flow is playing
- WHEN the user switches to a different view mode (e.g., "API Explorer")
- THEN `resetFlow()` clears all flow state
- AND animation stops

### REQ-VV-009: Approximate Service Tail Visual Indicator

Steps beyond the controller handler in the lifecycle SHALL visually indicate their approximate nature. Each approximate step SHALL display an `(approx)` badge on the node and a dashed stroke on the connecting edge. The indicator SHALL be visually distinct but not alarmist — a muted badge using `text-xs text-muted-foreground/60`, not a warning color.

#### Scenario: Approximate step shows badge and dashed edge

- GIVEN a lifecycle step with `approximate: true`
- WHEN the token travels along its edge
- THEN the edge renders with a dashed stroke pattern
- AND the target node shows an "(approx)" badge in muted styling

#### Scenario: Accurate step has solid edge and no badge

- GIVEN a lifecycle step with `approximate: false` (e.g., middleware → guard — real from decorators)
- WHEN the token travels along its edge
- THEN the edge renders with a solid stroke
- AND the target node shows no "(approx)" badge

### REQ-VV-010: Old Snapshot Compatibility

When a snapshot predates the flow data version (`flowAvailable: false` from API), the REQUEST_FLOW view SHALL display: "Flow data is not available for this snapshot. Re-analyze the repository to enable request-flow visualization." No endpoints SHALL be selectable for flow animation. No flow data SHALL be fabricated.

#### Scenario: Old snapshot shows unavailable message

- GIVEN a snapshot with `flowAvailable: false`
- WHEN the user selects the REQUEST_FLOW view
- THEN the message "Flow data is not available for this snapshot" is displayed
- AND no endpoint nodes are clickable for flow animation

#### Scenario: Class-level approximate fallback considered (future)

- GIVEN a snapshot with `flowAvailable: false` but built post-enrichment (class-level lifecycle nodes exist)
- WHEN the flow endpoint is queried
- THEN `flowAvailable` is still `false` for v1
- (Future enhancement may return class-level lifecycle as approximate tail — not in this change)

## References

- RFC-008 §6 (Visualization Modes), §12 (Integration)
- KG Model spec: node types for filter mapping; `INVOKES`/`INJECTS`/`PROTECTS`/`TRANSFORMS` edge types for the flow view
- IR spec: `IrEndpoint.lifecycle` / `typedParams` / `IrClass.constructorParams` drive the ordered flow steps
- `atoms/input.tsx` for search bar component
- Layer heuristics pattern: see EPIC-006 for path-segment derivation
- `graph-api.ts`: `getEndpointFlow()` client method
- `edge-path.tsx`: token animation rendered within the existing `EdgePath` component
