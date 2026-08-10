# Design: Request-Flow Visualization

## Technical Approach

**Hybrid (Approach C)**: endpoint-level lifecycle data is projected from existing IR fields (`IrMethod.decorators/params`, `IrClass.constructorParams`) — these are already populated by the parser. The design adds two projection layers: `IrEndpoint.lifecycle` + `IrEndpoint.typedParams` in `buildEndpoints()`, and edge creation in `SemanticModelBuilder`. No method-body AST analysis — service call order is `approximate: true`, derived from DI + import reachability.

```
Parser (ts-morph) ──→ IrMethod.decorators/params ──→ buildEndpoints() ──→ IrEndpoint.lifecycle/typedParams
                                                       (projection)
                                                                          │
                              IrClass.constructorParams ──────────────────┤
                                                                          ▼
                                                    SemanticModelBuilder ──→ GraphNodes + Edges
                                                                                    │
                    GET /graph/:repoId/endpoints/:fqn/flow ← graph-query.service ←─┘
                                 │
                                 ▼
                    Frontend: getEndpointFlow() → flowSlice → token animation (rAF)
```

## Architecture Decisions

| Decision               | Choice                                                     | Rationale                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **IR projection**      | Project `IrMethod` onto `IrEndpoint` in `buildEndpoints()` | Method already in scope; avoids re-parsing. Fields named `lifecycle`/`typedParams` (reconciled from stale delta)                            |
| **Lifecycle node FQN** | Reuse `${cls.fqn}~kind:name`                               | Same scheme as `addLifecycleNodes()` — FQN dedup prevents duplicate nodes when class-level (AI) and endpoint-level (parser) entries overlap |
| **INVOKES vs CALLS**   | `INVOKES` now; `CALLS` deferred                            | Separates certainty: INVOKES carries `approximate: true`; CALLS reserved for future body analysis                                           |
| **Graph version**      | v1→v2; `flowAvailable: false` for v1                       | Graceful fallback: post-enrichment v1 snapshots have class-level lifecycle nodes — return as approximate tail                               |
| **Token animation**    | SVG-direct: `<circle>` + `rAF` + `getPointAtLength()`      | No per-frame React state. Direct DOM mutation on `EdgePath`'s existing `<g>` avoids jank with `onlyRenderVisibleElements`                   |
| **EVENT_FLOW**         | Preserved as #7; REQUEST_FLOW as #8                        | EVENT_FLOW is async/message-driven — repurposing confuses future domain                                                                     |

## File Changes

| File                                         | Action | Description                                                                                                                                         |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/.../edge-type.enum.ts`          | Modify | Add `INVOKES`, `INJECTS` (8→10)                                                                                                                     |
| `src/backend/.../ir-nodes.ts`                | Modify | Add `IrEndpointProps.lifecycle` + `typedParams`; `LifecycleEntry`/`TypedParam` interfaces                                                           |
| `src/backend/.../typescript-ir-builder.ts`   | Modify | `buildEndpoints()` projects `IrMethod.decorators→lifecycle`, `IrMethod.params→typedParams`                                                          |
| `src/backend/.../decorator-role-registry.ts` | Modify | Add `UsePipes`→`pipe`, `UseInterceptors`→`interceptor`, `Body`→`body`, `Param`→`param`, `Query`→`query`, `Headers`→`headers`                        |
| `src/backend/.../semantic-model.builder.ts`  | Modify | `build()` calls new `addEndpointLifecycleEdges()`, `addInjectsEdges()`, `addInvokesEdges()`, `addDtoEdges()` after existing loop; reuses FQN scheme |
| `src/backend/.../graph-query.service.ts`     | Modify | `getEndpointFlow(repoId, fqn)` — assembles ordered steps from neighborhood edges + `typedParams`                                                    |
| `src/backend/.../graph-query.dto.ts`         | Modify | `EndpointFlowQueryDto` + `EndpointFlowResponseDto`                                                                                                  |
| `src/backend/.../graph.controller.ts`        | Modify | `GET /graph/:repoId/endpoints/:fqn/flow`                                                                                                            |
| `src/frontend/.../types.ts`                  | Modify | `EdgeType + INVOKES, INJECTS` (8→10); `RequestFlowStep`, `RequestFlow` interfaces; `ViewMode + REQUEST_FLOW`                                        |
| `src/frontend/.../views.ts`                  | Modify | `REQUEST_FLOW` ViewConfig (#8, hierarchical, lifecycle edges)                                                                                       |
| `src/frontend/.../graph-store.ts`            | Modify | `FlowSlice` state + actions (REQ-VV-008)                                                                                                            |
| `src/frontend/.../graph-api.ts`              | Modify | `getEndpointFlow(repoId, fqn)`                                                                                                                      |
| `src/frontend/.../edge-path.tsx`             | Modify | Accept optional `animationToken` prop; render traveling `<circle>` mutation via rAF/useRef                                                          |
| `src/frontend/.../graph-workspace.tsx`       | Modify | REQUEST_FLOW branch: endpoint click → `getEndpointFlow()` → `startFlow()`                                                                           |
| `src/frontend/.../graph-detail-panel.tsx`    | Modify | Flow step list when `flowSteps` populated; show `(approx)` badge for approximate steps                                                              |
| `src/frontend/.../node-style.ts`             | Modify | Style entries for INVOKES/INJECTS edges (compiler-enforced)                                                                                         |
| `src/frontend/.../edges/index.ts`            | Modify | Register `InvokesEdge`, `InjectsEdge` components                                                                                                    |

## Data Contracts

**`RequestFlowStep`** (API response):

```typescript
interface RequestFlowStep {
  order: number;
  kind: 'middleware' | 'guard' | 'pipe' | 'interceptor' | 'handler' | 'service' | 'repository';
  nodeFqn: string;
  nodeLabel: string;
  edgeType: EdgeType; // how this step connects to the next
  payloadType?: string | null; // DTO type from typedParams (null for non-handler steps)
  approximate: boolean; // true for service tail (INVOKES-derived)
}
```

**`EndpointFlowResponse`**: `{ flowAvailable: boolean; steps: RequestFlowStep[]; endpointFqn: string }`

**Graceful fallback**: when `flowAvailable: false` and snapshot has class-level lifecycle nodes: return those nodes as approximate steps (single-step, no ordering). When no lifecycle at all: return empty steps + `flowAvailable: false`.

## Testing Strategy

| Layer                 | What to Test                                       | Approach                                                     |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Unit (backend)        | `buildEndpoints()` lifecycle projection            | Jest: mock IrMethod → assert output                          |
| Unit (backend)        | `SemanticModelBuilder` INJECTS + endpoint PROTECTS | Jest: IR with `constructorParams` + endpoint `lifecycle`     |
| Unit (backend)        | `DecoratorRoleRegistry` additions                  | Jest: `getRole('UsePipes')` → `'pipe'`                       |
| Integration (backend) | Flow endpoint returns ordered steps                | Supertest: seed graph, query flow, assert order              |
| Unit (frontend)       | `EdgeType` = 10, `ViewMode` = 8                    | Vitest: `types.test.ts` count assertions                     |
| Unit (frontend)       | `FlowSlice` transitions                            | Vitest: store actions (`startFlow`, `nextStep`, `resetFlow`) |
| Unit (frontend)       | `getEndpointFlow` query                            | Vitest: `buildQueryString` with fqn encoding                 |

## Migration / Rollout

- **Version bump**: v1→v2. Old snapshots return `flowAvailable: false`. Frontend shows "Re-analyze to enable." Post-enrichment v1 snapshots already have class-level lifecycle nodes — future enhancement can surface these as approximate without another version bump.
- **No schema migration**: `varchar(64)` type + `jsonb` properties are additive-friendly.
- **Rollback**: single revert. Old snapshots stay valid. Frontend drops REQUEST_FLOW chip from registry.
