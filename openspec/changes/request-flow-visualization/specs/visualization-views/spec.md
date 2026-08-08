# Delta for visualization-views

> **Re-baselined 2026-08-07**: Frontend mirror sync (`types.ts` — 16 NodeType + 8 EdgeType members) is NOW DONE (fixed the active regression). This delta adds the REQUEST_FLOW view, flow simulation store, token animation, and click-to-play wiring. The `EVENT_FLOW` placeholder (#7) is preserved untouched.

## ADDED Requirements

### [NEW] REQ-VV-005: Request Flow View Mode

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

### [NEW] REQ-VV-006: Endpoint Click → Flow Data Fetch

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

### [NEW] REQ-VV-007: Token Animation Along Edge Paths

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

### [NEW] REQ-VV-008: Flow State Store Slice

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

### [NEW] REQ-VV-009: Approximate Service Tail Visual Indicator

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

### [NEW] REQ-VV-010: Old Snapshot Compatibility

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

## MODIFIED Requirements

### REQ-VV-001: View Mode Switcher

The system MUST render a view switcher component using styled mode chips (`.glass-subtle`, `text-sm`, `font-medium`). Switching views SHALL trigger layout recomputation and appear instant (<100ms perceived). Active view SHALL use `primary-500` accent border. The view switcher SHALL include the new `REQUEST_FLOW` chip as the 8th option.

(Previously: 7 view chips; no REQUEST_FLOW option)

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

## Cross-References

- **knowledge-graph-model**: frontend `EdgeType` enum must mirror the 2 new edge types (`INVOKES`, `INJECTS` — 8→10 members). `GraphSnapshot` must include `flowAvailable: boolean`.
- **intermediate-representation**: `IrEndpoint.lifecycle` and `IrEndpoint.typedParams` drive the ordered steps; `IrClass.constructorParams` populates the approximate service tail.
- **typescript-parser**: extracted decorators and type annotations are the upstream source of all flow data.
- **REQ-VV-004 (Viewport Culling)**: applies to flow edges as well — off-screen edges are culled; animation token respects viewport visibility.
- **`graph-api.ts`**: new `getEndpointFlow()` client method calling the flow endpoint.
- **`edge-path.tsx`**: token animation is rendered within the existing `EdgePath` component (reused by all edge types).

## [DONE] Frontend Mirror Sync (pre-requisite, now complete)

The `lib/visualization/types.ts` now mirrors the backend: 16 `NodeType` members (including Guard/Pipe/Interceptor/Middleware) and 8 `EdgeType` members (including PROTECTS/TRANSFORMS). The `NODE_STYLE` registry, filter chips (`Object.values`), and `types.test.ts` assertions have been updated accordingly. This unblocks visibility of the ai-enrichment lifecycle data and is a pre-requisite for the flow view.

**Remaining mirror work for this change**: `EdgeType` enum must add `INVOKES` and `INJECTS` (8→10), with corresponding edge component registrations, style entries, and test count updates.
