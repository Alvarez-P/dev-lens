# Tasks: Request-Flow Visualization

## Review Workload Forecast

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| Estimated changed lines | 1,300–1,700               |
| 400-line budget risk    | High                      |
| Chained PRs recommended | Yes                       |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy       | ask-always                |
| Chain strategy          | feature-branch-chain      |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

TDD: RED first.

### Suggested Work Units

| Unit | Goal                                         | Likely PR | Notes              |
| ---- | -------------------------------------------- | --------- | ------------------ |
| 1    | Parser registry + IR projection + edge enums | PR 1      | Tracker base; jest |
| 2    | SemanticModelBuilder edges + flow API        | PR 2      | Base: PR 1         |
| 3    | Frontend types, views, FlowSlice, API        | PR 3      | Base: PR 2         |
| 4    | Token animation + wiring + detail panel      | PR 4      | Base: PR 3         |

## Phase 1: Backend Parser & IR (PR 1)

- [x] 1.1 RED: `decorator-role-registry.spec.ts`: UsePipes→pipe, UseInterceptors→interceptor, Body→body, Param→param, Query→query, Headers→headers
- [x] 1.2 Add 6 entries to `src/backend/src/modules/analysis/infrastructure/parsers/decorator-role-registry.ts`
- [x] 1.3 Add `LifecycleEntry`/`TypedParam` + `lifecycle`/`typedParams` on `IrEndpointProps` in `src/backend/src/modules/analysis/domain/ir-nodes.ts`
- [x] 1.4 RED: `typescript-ir-builder.spec.ts`: buildEndpoints() projects decorators→lifecycle (order), params→typedParams (null), empty lists
- [x] 1.5 Implement projection in `buildEndpoints()` in `src/backend/src/modules/analysis/infrastructure/parsers/typescript/typescript-ir-builder.ts`
- [x] 1.6 Add `INVOKES`/`INJECTS` to `src/backend/src/modules/knowledge-graph/domain/edge-type.enum.ts` (8→10); update tests

## Phase 2: Backend Graph Model & Flow API (PR 2)

- [x] 2.1 RED: `semantic-model.builder.spec.ts`: INJECTS, INVOKES C→S→R (approx), ep PROTECTS/TRANSFORMS, DEPENDS_ON (parameter-type)
- [x] 2.2 Add `addInjectsEdges`/`addInvokesEdges`/`addEndpointLifecycleEdges`/`addDtoEdges` in `src/backend/src/modules/knowledge-graph/application/semantic-model.builder.ts`
- [x] 2.3 Add flow DTOs to `src/backend/src/modules/knowledge-graph/infrastructure/controllers/graph-query.dto.ts`
- [x] 2.4 RED: `graph-query.service.spec.ts`: ordered steps, approx tail, `flowAvailable:false` v1
- [x] 2.5 Implement `getEndpointFlow()` in `src/backend/src/modules/knowledge-graph/application/graph-query.service.ts`; bump version + `flowAvailable`
- [x] 2.6 Add `GET /graph/:repoId/endpoints/:fqn/flow` in `src/backend/src/modules/knowledge-graph/infrastructure/controllers/graph.controller.ts`
- [x] 2.7 Supertest e2e: HTTP 200 + ordered steps (no 404/500)

## Phase 3: Frontend Types, Store & API (PR 3)

- [x] 3.1 `types.ts`: EdgeType +INVOKES/INJECTS (10), ViewMode.REQUEST_FLOW, RequestFlowStep/RequestFlow
- [x] 3.2 RED: `types.test.ts`: 10 edges, 8 views, step shape
- [x] 3.3 `views.ts`: REQUEST_FLOW config (#8)
- [x] 3.4 RED: store tests: startFlow, nextStep, pauseFlow, resetFlow on switch
- [x] 3.5 Implement `flowSlice` in `src/frontend/src/lib/visualization/store/graph-store.ts`
- [x] 3.6 `graph-api.ts`: `getEndpointFlow(repoId, fqn)` + fqn encoding test
- [x] 3.7 `node-style.ts` entries + register InvokesEdge/InjectsEdge in `src/frontend/src/components/graph/canvas/edges/index.ts`

## Phase 4: Frontend Animation & Wiring (PR 4)

- [ ] 4.1 `edge-path.tsx`: animationToken prop; rAF + getPointAtLength circle on `<g>` (no re-render); respect culling
- [ ] 4.2 `graph-workspace.tsx`: endpoint click → fetch+startFlow; ignore non-endpoint; old-snapshot msg
- [ ] 4.3 `graph-detail-panel.tsx`: step list + (approx) badge + dashed edge
- [ ] 4.4 Tests: token travel, dashed edges, click wiring, fallback, reset
- [ ] 4.5 Verify 60fps @ 500+ nodes w/ culling

## Phase 5: Verification & Cleanup

- [ ] 5.1 `pnpm -r test`, build, lint green
- [ ] 5.2 Update docs; remove temp code; EVENT_FLOW #7 untouched
- [ ] 5.3 Verify REQ-VV-005..010 + IR/KG/parser deltas; mark complete
