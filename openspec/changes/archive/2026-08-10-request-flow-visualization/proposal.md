# Proposal: Request-Flow Visualization

## Intent

The force-directed dependency graph is unreadable ("no se entiende nada"). DevLens must let a developer click an endpoint and watch the real request lifecycle — guards → pipes → controller handler → services — with DTO typing flowing between nodes. Readability fix, not decoration: data shown must be real, never fabricated.

## Scope

**In**: method-level `@UseGuards/@UsePipes/@UseInterceptors` (+args), param type annotations, constructor injection · IR lifecycle fields + typed params + DI list · node types `GUARD/PIPE/INTERCEPTOR/MIDDLEWARE` + edges `PROTECTS/TRANSFORMS/INVOKES/INJECTS` + mapping · `GET /graph/:repoId/endpoints/:fqn/flow` (ordered steps + payload types, service tail `approximate: true`) · Request Flow view, token animation, click-to-play, store slice.

**Out**: method-body call-graph (deferred behind `approximate`) · AI/LLM classification · EVENT_FLOW data tracking.

## Capabilities

### New

None.

### Modified

- `knowledge-graph-model`: lifecycle node + edge types in taxonomies
- `intermediate-representation`: `IrEndpoint` lifecycle/typed params; `IrClass` DI list
- `typescript-parser`: method decorators, param types, constructor injection
- `visualization-views`: add REQUEST_FLOW view; EVENT_FLOW untouched

## Approach

Hybrid (Exploration C): extract only deterministic decorator/annotation data — accurate, testable. Service tail derives from DI order + import reachability, flagged `approximate`. Rejects A (fabricated lifecycle misleads); defers B's method-body heuristics.

**Pinned**: new REQUEST_FLOW view; version bump, old snapshots return `flowAvailable: false`.

## Affected Areas

| Area                                                                               | Impact                                    |
| ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `typescript-parser.ts`, `typescript-ir-builder.ts`, `decorator-role-registry.ts`   | Modified: lifecycle/DI extraction         |
| `analysis/domain/ir-nodes.ts`                                                      | Modified: lifecycle + DI fields           |
| `node-type.enum.ts`, `edge-type.enum.ts`, `semantic-model.builder.ts`              | Modified: new types + mapping             |
| `graph-query.service.ts`, `graph.controller.ts`, `graph-query.dto.ts`              | Modified: flow endpoint                   |
| `frontend/lib/visualization/{types,graph-api,views}.ts`, `graph-store.ts`          | Modified: flow types/client/view/slice    |
| `edge-path.tsx`, `canvas/nodes/*`, `graph-workspace.tsx`, `graph-detail-panel.tsx` | Modified: animation, nodes, click-to-play |

## Risks

| Risk                                     | Likelihood | Mitigation                                  |
| ---------------------------------------- | ---------- | ------------------------------------------- |
| Enum ripple (mirrors, filters)           | Med        | Additive; move mirrors together             |
| Old snapshots lack flow data             | High       | Version bump; `flowAvailable: false`        |
| Animation perf                           | Med        | SVG-direct token; no per-frame state        |
| Misleading approximation                 | Med        | Explicit `approximate` treatment            |
| Parser edge cases (APP_GUARD, multi-arg) | Med        | Deterministic subset; unsupported → omitted |

## Rollback Plan

Single revert of parser/IR/model changes; flow data additive, old snapshots stay valid. Frontend: revert via view registry.

## Dependencies

- Parser first — IR fields are the contract for graph, API, frontend
- Existing `EdgePath` + adapter isolation (VE-001)

## Success Criteria

- [ ] Endpoint click plays lifecycle with DTO chips on edges
- [ ] Flow data from real decorators; approximate segments visibly labeled
- [ ] Flow endpoint returns ordered steps + payload types, tested
- [ ] 60fps animation with `onlyRenderVisibleElements`, no per-frame re-renders
- [ ] 4 delta specs merged; enum mirrors consistent backend ↔ frontend
