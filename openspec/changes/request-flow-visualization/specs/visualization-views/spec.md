# Delta for visualization-views

## ADDED Requirements

### REQ-VV-005: Request Flow View Mode

The system SHALL provide a `REQUEST_FLOW` view (`ViewMode.REQUEST_FLOW`) in the view switcher. Selecting it SHALL render an interactive flow canvas that replaces the standard graph layout. The view SHALL initially display a prompt: "Select an endpoint to visualize its request flow."

**Scenarios:**

- GIVEN the graph is loaded in any view
- WHEN the user clicks the "Request Flow" view chip
- THEN the canvas transitions to the flow view
- AND displays the endpoint-selection prompt

### REQ-VV-006: Endpoint Click → Flow Data Fetch

When the user clicks an endpoint node in the REQUEST_FLOW view, the system SHALL fetch flow data via `GET /api/v1/graph/:repoId/endpoints/:fqn/flow`. The response SHALL contain ordered lifecycle steps with `kind`, `classRef`, and `payloadType` (the DTO type annotation). The service tail beyond the handler SHALL carry `approximate: true`.

**Scenarios:**

- GIVEN the REQUEST_FLOW view is active
- WHEN the user clicks an endpoint node
- THEN `getEndpointFlow(repoId, fqn)` is called
- AND the flow data is loaded into the flow state slice

- GIVEN flow data has been fetched for an endpoint
- WHEN the user clicks a different endpoint
- THEN the previous flow state is replaced with the new endpoint's data

### REQ-VV-007: Token Animation Along Edge Paths

The system SHALL animate a visual token along the lifecycle step edges using SVG-direct animation (`requestAnimationFrame` + `path.getPointAtLength()`). The token SHALL carry a DTO type label when a `payloadType` is present. The animation MUST NOT trigger per-frame React re-renders — token position SHALL be mutated directly on the SVG `<g>` element.

**Scenarios:**

- GIVEN flow data with 5 lifecycle steps
- WHEN the animation starts
- THEN a token circle travels along EdgePath from step 1 through step 5 sequentially
- AND each edge shows the DTO type name on the token when `payloadType` is set
- AND the canvas stays at 60fps when `onlyRenderVisibleElements` is active

### REQ-VV-008: Flow State Store Slice

The Zustand graph store SHALL include a `flowSlice` with: `activeEndpointFqn` (string | null), `flowSteps` (ordered lifecycle step array), `currentStepIndex` (number), `isPlaying` (boolean), and `animationSpeed` (1x default). Actions: `startFlow(fqn, steps)`, `nextStep()`, `pauseFlow()`, `resetFlow()`. Resetting or navigating away SHALL clear flow state.

**Scenarios:**

- GIVEN the user clicks an endpoint
- WHEN flow data is fetched
- THEN `startFlow(fqn, steps)` populates the flow slice and sets `currentStepIndex: 0`

- GIVEN a flow is playing
- WHEN the user switches to a different view mode
- THEN `resetFlow()` clears all flow state

### REQ-VV-009: Approximate Service Tail Indicator

Steps beyond the controller handler in the lifecycle sequence SHALL visually indicate their approximate nature. Each approximate step SHALL display a subtle `(approx)` label or dashed styling on the connecting edge. The indicator MUST be visually distinct but not alarmist — a muted badge, not a warning.

**Scenarios:**

- GIVEN a lifecycle step with `approximate: true`
- WHEN the token travels along its edge
- THEN the edge renders with a dashed stroke pattern
- AND the step node shows an "(approx)" badge

### REQ-VV-010: Old Snapshot Compatibility

When a snapshot predates the flow data version, the REQUEST_FLOW view SHALL display: "Flow data is not available for this snapshot. Re-analyze the repository to enable request-flow visualization." No flow-related data SHALL be fabricated for old snapshots.

**Scenarios:**

- GIVEN a snapshot with `flowAvailable: false` from the API
- WHEN the user selects the REQUEST_FLOW view
- THEN the message "Flow data is not available for this snapshot" is displayed
- AND no endpoints are selectable for flow animation

## Cross-References

- **knowledge-graph-model**: frontend `NodeType`/`EdgeType` enums must mirror the 4 new lifecycle types and 4 new edge types. The flow endpoint returns nodes/edges using these types.
- **intermediate-representation**: `IrEndpoint.lifecycle` and `IrEndpoint.typedParams` drive the ordered steps; `IrClass.injectedDependencies` populates the approximate service tail.
- **typescript-parser**: extracted decorators and type annotations are the upstream source of all flow data.
- **REQ-VV-004 (Viewport Culling)**: applies to flow edges as well — off-screen edges are culled; animation token respects viewport visibility.

## Note: EVENT_FLOW Placeholder

The `EVENT_FLOW` view (view #7) remains a placeholder with no modifications in this change. Its `isEmptyState: true` configuration and empty-state message are preserved exactly as-is.
