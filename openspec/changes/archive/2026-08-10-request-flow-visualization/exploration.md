# Exploration: Request-Flow Visualization (dynamic API lifecycle view)

> Phase: sdd-explore | Date: 2026-08-06 | Mode: openspec
> Change folder: `openspec/changes/request-flow-visualization/`
> User motivation: "no se entiende nada" — the force-directed dependency graph is
> unreadable. Vision: click an endpoint → animated request lifecycle (middleware →
> guards → pipes → controller → service → repository) with DTO typing traveling
> between nodes.

---

# UPDATE 2026-08-07 — Post ai-enrichment merge (READ FIRST)

> The `ai-enrichment` epic (PRs #5–#7, merged `fe5dde2`) landed AFTER the original
> exploration below was written. It implemented HALF of what this change planned.
> The original body remains below for history; this section is the corrected
> baseline. Everything here was verified against `main` (2026-08-07).

## 0. What ai-enrichment already delivered (verified)

| Item (planned by this change)                  | Status                           | Evidence                                                                                                            |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GUARD/PIPE/INTERCEPTOR/MIDDLEWARE` node types | ✅ DONE                          | `node-type.enum.ts` (17 members incl. `UNKNOWN`)                                                                    |
| `PROTECTS`/`TRANSFORMS` edge types             | ✅ DONE                          | `edge-type.enum.ts` (8 members)                                                                                     |
| Backend DTO validation for new types           | ✅ DONE                          | `graph-query.dto.ts` uses `Object.values(NodeType/EdgeType)` — additive, no change needed                           |
| Method-level decorator extraction (with args)  | ✅ DONE (IR level)               | `typescript-ir-builder.ts` `buildMethod()` → `IrMethod.decorators: string[]` (`@UseGuards(JwtGuard)` kept verbatim) |
| Parameter type annotations                     | ✅ DONE (IR level)               | `IrMethod.params: {name, type, decorators}[]` + `returnType`                                                        |
| Constructor injection tracking                 | ✅ DONE (IR level)               | `IrClass.constructorParams: {name, type, decorators}[]` via `buildConstructorParams()`                              |
| Semantic-model merge of enrichment             | ✅ DONE (class-level only)       | `semantic-model.builder.ts` `addLifecycleNodes()` + `ROLE_TO_TYPE` AI override                                      |
| Persistence additive + versioned               | ✅ unchanged                     | varchar(64) + jsonb; no migration needed                                                                            |
| Frontend enum mirror                           | ❌ STALE — **active regression** | `types.ts` still 12/6; `filter.ts` drops `'Guard'`/`'PROTECTS'` from every view                                     |

### 0.1 The class-level gap in the AI mapping

`addLifecycleNodes()` creates lifecycle nodes from enrichment `lifecycle` entries
(`guard:JwtGuard` → `parseLifecycleEntry`) with PROTECTS/TRANSFORMS edges that point
at the **owning CLASS** (`lifecycleFqn → cls.fqn`, fqn scheme `${cls.fqn}~kind:name`).
The classify-lifecycle v1 prompt is **class-level only** — it collapses a controller to
`lifecycle: ["handler"]` and never says WHICH guard/pipes apply to WHICH endpoint. So
the graph today knows "JwtGuard protects UsersController" but NOT "GET /users is
protected by JwtGuard". No PROTECTS edge targets an `ENDPOINT` node, and no
`INVOKES`/`INJECTS` edge exists anywhere in `src/`.

### 0.2 Frontend mirror is broken today — lifecycle data is invisible

- `lib/visualization/types.ts` mirrors 12 NodeType / 6 EdgeType — missing all 6 new members.
- `canvas/filter.ts` keeps a node iff `visibleNodeTypes.includes(node.type)` and an edge
  iff `visibleEdgeTypes.includes(edge.type)`; those arrays derive from the STALE enum.
  → Enriched `Guard/Pipe/Interceptor/Middleware` nodes and `PROTECTS/TRANSFORMS` edges
  are **filtered out of every view**. The data exists in the graph and is dropped by the UI.
- `NODE_STYLE: Record<NodeType, NodeStyle>` (node-style.ts) will FAIL to compile once the
  enum grows — the compiler enforces the style sync. Filter-bar chips and
  `countActiveFilters` also iterate `Object.values(NodeType/EdgeType)`, so they move with it.
- `lib/visualization/__tests__/types.test.ts` hard-asserts lengths `12 / 6 / 7` and the
  exact value lists — these tests break on sync and must move together (part of the ripple).

## 1. What still needs to be created (reduced scope)

1. **`INVOKES` + `INJECTS` edge types** — absent from `edge-type.enum.ts` and everywhere else.
2. **Endpoint-level lifecycle extraction** — `IrEndpoint` still carries only name-only
   `parameters: string[]`; the decorators/typed params already live on the owning
   `IrMethod` but are never projected onto the endpoint. `decorator-role-registry.ts`
   still lacks `UsePipes`, `UseInterceptors`, `Body`, `Param`, `Query`, `Headers`.
3. **Endpoint → DTO typing edges** — `endpointNode()` drops even `parameters` (properties
   are `{httpMethod, path}` only); no endpoint→DTO edges exist.
4. **Constructor DI → `INJECTS` edges** — `IrClass.constructorParams` is consumed ONLY by
   the AI sketch builder (`code-sketch.builder.ts`); `semantic-model.builder.ts` never maps it.
5. **`GET /graph/:repoId/endpoints/:fqn/flow`** — no endpoint, no DTO, no assembly in
   `graph-query.service.ts`.
6. **Frontend flow surface** — `getEndpointFlow` client, `REQUEST_FLOW` view (EVENT_FLOW
   placeholder untouched), flow slice in `graph-store.ts`, token animation in
   `edge-path.tsx`, Guard/Pipe/Interceptor/Middleware node components +
   PROTECTS/TRANSFORMS/INVOKES/INJECTS edge components + registries, click-to-play in
   `graph-workspace.tsx` (node click currently only selects; drill-down is double-click),
   flow steps in `graph-detail-panel.tsx`.
7. **Spec deltas: reconcile naming drift** — the existing deltas in
   `openspec/changes/request-flow-visualization/specs/` propose `IrEndpoint.lifecycle`,
   `IrEndpoint.typedParams`, `IrClass.injectedDependencies`; the code already has
   `IrMethod.decorators/params` and `IrClass.constructorParams`. Decide: add thin
   projection fields on `IrEndpoint` (endpoints are already built FROM the method in
   `buildEndpoints()`, so this is cheap) and keep `constructorParams` (renaming breaks
   the AI sketch pipeline) — i.e. the semantic layer aliases it as injected deps.

## 2. Re-baselined approaches

| Approach                         | Original verdict          | Now                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Frontend-only simulation** | Rejected (fabricates)     | Still rejected, but weaker: real **class-level** lifecycle nodes now exist in the graph, so a frontend could attribute class-level guards to a controller's endpoints with an `approximate` flag. Still no per-endpoint order, still misleading unless labeled.                                                                       |
| **B — Full backend extraction**  | Effort High, ~60% backend | Drops to **Medium**: the hard extraction (method decorators with args, typed params, ctor DI) is ALREADY in the IR. Remaining backend is projection onto `IrEndpoint`, registry additions, `INVOKES`/`INJECTS` + endpoint-level mapping, and the flow API. Method-body call analysis remains the only genuinely hard, deferred piece. |
| **C — Hybrid**                   | Recommended               | Still recommended — and now nearly free on the backend side: the accurate prefix (middleware→handler) is deterministic projection of existing IR data, the DI-based service tail still carries `approximate: true`.                                                                                                                   |

## 3. Updated recommendation — refreshed Approach C

**Sequencing (adjusted for the new baseline):**

1. **Frontend mirror sync FIRST** — `types.ts` (4 node + 4 edge members), `NODE_STYLE`
   entries, node/edge registries + minimal default-style components, `types.test.ts`
   counts. Unblocks visibility of the enrichment data that already exists (fixes the
   active regression) and de-risks every later step (the ripple stops compounding).
2. **IR projection** — extend `IrEndpoint` with `lifecycle` + `typedParams` derived from
   the owning method in `buildEndpoints()`; add `UsePipes/UseInterceptors/Body/Param/
Query/Headers` to the registry. Keep `IrClass.constructorParams` as the DI source
   (no rename); treat it as injected-dependencies semantics in the mapping layer.
3. **Graph** — add `INVOKES` + `INJECTS`; in `semantic-model.builder.ts` reuse the
   existing lifecycle-node fqn scheme (`${cls.fqn}~kind:name`, dedupe by fqn) and add
   endpoint-level PROTECTS/TRANSFORMS/INVOKES edges from those nodes to ENDPOINTs;
   emit INJECTS edges from `constructorParams`.
4. **API** — `GET /graph/:repoId/endpoints/:fqn/flow` (ordered steps + `payloadType`,
   service tail `approximate: true`) in `graph.controller.ts` / `graph-query.dto.ts` /
   `graph-query.service.ts`.
5. **Frontend flow** — `getEndpointFlow`, `REQUEST_FLOW` view config, flow slice,
   token animation in `edge-path.tsx` (SVG-direct rAF, no per-frame React state),
   click-to-play in `graph-workspace.tsx`, flow steps in the detail panel.
6. **Specs** — refresh the 4 existing deltas to the reconciled field names.

**Open decisions for the proposal:**

- Mirror sync as step 0 of this change vs. a tiny standalone fix (recommended: inside
  this change, since the ripple is what this change is about).
- Reuse of class-level enrichment lifecycle nodes: for endpoints WITHOUT method-level
  decorators, attribute the controller's class-level guards/pipes to its endpoints as
  `approximate`? (Honest, and it finally surfaces existing data.)
- Extend classify-lifecycle to v2 per-endpoint output as a FUTURE improvement, not v1.

**Re-analysis policy (unchanged from proposal):** version bump; old snapshots return
`flowAvailable: false`. Nuance: snapshots built post-enrichment already contain
class-level lifecycle nodes, so a `flowAvailable: false` snapshot can still render the
approx class-level tail — the flow endpoint should degrade gracefully.

## 4. Updated affected areas (vs. original §4)

**Backend — new work**

- `knowledge-graph/domain/edge-type.enum.ts` — add `INVOKES`, `INJECTS`
- `knowledge-graph/application/graph-query.service.ts` — `getEndpointFlow()` assembly
- `knowledge-graph/infrastructure/controllers/graph.controller.ts` + `graph-query.dto.ts` — flow endpoint + DTO
- `knowledge-graph/application/semantic-model.builder.ts` — endpoint-level lifecycle edges + INJECTS (extend existing `addLifecycleNodes` path)

**Backend — mostly done, small deltas**

- `analysis/domain/ir-nodes.ts` — `IrEndpoint.lifecycle` + `typedParams` projection fields
- `analysis/infrastructure/parsers/typescript/typescript-ir-builder.ts` — project method decorators/params onto endpoints in `buildEndpoints()`
- `analysis/infrastructure/parsers/decorator-role-registry.ts` — `UsePipes`, `UseInterceptors`, `Body`, `Param`, `Query`, `Headers`

**Frontend**

- `lib/visualization/types.ts` — mirror sync (4 node + 4 edge members) + `RequestFlow`/`RequestFlowStep` types
- `lib/visualization/__tests__/types.test.ts` — mirror count assertions (12→17, 6→8, 7→8)
- `canvas/nodes/node-style.ts` — 4 style entries (compiler-enforced once the enum grows)
- `canvas/nodes/index.ts` + `canvas/nodes/*` — Guard/Pipe/Interceptor/Middleware node components
- `canvas/edges/index.ts` + `canvas/edges/*` — PROTECTS/TRANSFORMS/INVOKES/INJECTS edge components
- `lib/visualization/graph-api.ts` — `getEndpointFlow()`
- `lib/visualization/views.ts` — `REQUEST_FLOW` view config (+ `ViewMode` member)
- `lib/visualization/store/graph-store.ts` — flow slice (REQ-VV-008)
- `components/graph/canvas/edges/edge-path.tsx` — traveling-token renderer (rAF/`getPointAtLength`)
- `components/graph/graph-workspace.tsx` — REQUEST_FLOW branch + endpoint click → play
- `components/graph/graph-detail-panel.tsx` — flow step details
- `components/graph/graph-filter-bar.tsx` — moves automatically with `Object.values` + `NODE_STYLE`

**Specs** — refresh existing deltas: `intermediate-representation`, `knowledge-graph-model`,
`typescript-parser`, `visualization-views` (naming reconciliation per §1.7).

## 5. Updated risks

- **Enum ripple is now a LIVE bug, not a future one**: stale frontend mirror hides
  enrichment lifecycle data in every view today. Fix first (mirror sync); `NODE_STYLE`
  and `types.test.ts` are the compiler/test tripwires that catch drift.
- **Spec/code naming drift**: deltas say `injectedDependencies`/`typedParams`; code has
  `constructorParams`/`IrMethod.params`. Pin the reconciliation in the proposal or the
  deltas mislead implementers.
- **Duplicate lifecycle nodes**: endpoint-level extraction must reuse the class-level
  lifecycle node fqn scheme (`${cls.fqn}~kind:name`) or the graph gains duplicate
  guard nodes (builder dedupes by fqn — same fqn, no dupes; different scheme = dupes).
- **Coordination debt resolved**: ai-lifecycle-analysis exploration risk #5 ("avoid two
  implementations of the same graph contract") is resolved — ai-enrichment owns
  class-level classification; this change owns endpoint-level decorator projection.
  Keep them separate: enrichment feeds class-level nodes, parser feeds endpoint edges.
- **Re-analysis required for endpoint-level data** (class-level nodes already present
  post-enrichment). Old snapshots degrade to `flowAvailable: false`; consider the
  class-level-approx fallback (§3).
- **Animation perf** unchanged: token MUST be SVG-direct rAF, never per-frame React state.
- **Honesty of approximation** unchanged: `approximate` must be visually explicit.

## 6. Ready for Proposal

**Yes** — re-scoped against the post-enrichment baseline. The backend extraction is
mostly done; the change is now: mirror sync (step 0), endpoint-level projection +
`INVOKES`/`INJECTS`, flow API, and the frontend flow surface. Proposal should pin:
the mirror-sync placement (inside this change), the spec naming reconciliation, the
class-level-approx reuse decision, and the re-analysis policy (`flowAvailable: false`

- graceful class-level fallback).

---

# ORIGINAL EXPLORATION (2026-08-06) — superseded in part by the update above

> Sections §1.1, §1.2 (gaps 1–4), §2, §3, §4 of the original are re-baselined by the
> update above. Kept verbatim for the audit trail.

## 1. Current State

### 1.1 Backend data available today

**Graph API** (`knowledge-graph/infrastructure/controllers/graph.controller.ts` + `graph-query.dto.ts`):

| Endpoint                               | Returns                                           |
| -------------------------------------- | ------------------------------------------------- |
| `GET /api/v1/graph/:repoId`            | Latest snapshot summary (counts, version, status) |
| `GET /api/v1/graph/:repoId/export`     | Full graph: all nodes + edges + meta (versioned)  |
| `GET /api/v1/graph/:repoId/nodes`      | Paginated nodes, optional `type` multi-filter     |
| `GET /api/v1/graph/:repoId/nodes/:fqn` | Node + connected edges, `direction=in\|out\|both` |
| `GET /api/v1/graph/:repoId/edges`      | Paginated edges, optional source/target/type      |

**Node types** (`node-type.enum.ts`, 12): `PROJECT, PACKAGE, MODULE, CONTROLLER, SERVICE, REPOSITORY, ENTITY, DTO, INTERFACE, ENDPOINT, EXTERNAL_DEPENDENCY, UNKNOWN`.

- Endpoints exist as `ENDPOINT` nodes; properties are `{ httpMethod, path, filePath }` — plus `parameters: string[]` which are **parameter NAMES only, no type annotations** (`semantic-model.builder.ts` → `endpointNode()`).

**Edge types** (`edge-type.enum.ts`, 6) — all **structural**, no flow semantics:

| Edge                     | Meaning                                      |
| ------------------------ | -------------------------------------------- |
| `BELONGS_TO`             | Containment (child → module/package/project) |
| `EXPOSES`                | Controller → Endpoint (HTTP decorator)       |
| `DEPENDS_ON`             | Import statement (module-level)              |
| `IMPORTS`                | Module → ExternalDependency                  |
| `EXTENDS` / `IMPLEMENTS` | Inheritance / interface contract             |

**IR** (`analysis/domain/ir-nodes.ts`): `IrClass { name, role, extends, implements, methods, endpoints }`; `IrEndpoint { name, httpMethod, path, parameters: string[] }`. Roles come from `DecoratorRoleRegistry` (`@Controller`, `@Injectable`, `@Module`, `@UseGuards`→guard, `@Middleware`→middleware, `@Catch`→exception-filter) and interface-based resolution (`implements CanActivate`→guard, `NestInterceptor`→interceptor, `PipeTransform`→pipe).

### 1.2 What the backend does NOT have (gaps)

1. **No endpoint-level lifecycle data.** Method-level `@UseGuards/@UsePipes/@UseInterceptors` are never parsed. `UseGuards` in the registry only ever labels the _class that carries the decorator_ — it never links "endpoint X is protected by guard Y". There is no `middleware` chain, no per-parameter pipes.
2. **No DTO typing.** `IrEndpoint.parameters` is `string[]` of names. The type annotation (`@Body() dto: CreateUserDto`) is discarded. `DTO` nodes exist (name heuristic) but nothing connects an endpoint to its DTOs.
3. **No DI / call graph.** Constructor injection is not captured, and method bodies are not analyzed for calls — no "controller calls service" edge exists. `DEPENDS_ON` is import-granularity only.
4. **No request-flow concept** anywhere: IR → SemanticModel → Graph are all structural.
5. Persistence (`graph-node/edge.typeorm-entity.ts`) is **additive-friendly**: `type` is `varchar(64)` and `properties` is `jsonb` — new node/edge types and new properties need no schema migration, only enum + validator + frontend-mirror updates. Graph is versioned per snapshot, so old snapshots remain readable.

### 1.3 Frontend visualization architecture

**Stack** (`frontend/package.json` + lockfile): `@xyflow/react@12.11.2` (React Flow v12), `@dagrejs/dagre@3.1.0`, `d3-force@3.0.0`, Zustand 4, TanStack Query 5, Next 15.5 / React 19.2. **No framer-motion, no gsap.**

- **Adapter isolation (VE-001)**: `GraphRendererAdapter` contract (`lib/visualization/adapter.ts`) is the only place `@xyflow/react` is imported. `react-flow-adapter.tsx` maps `GraphNode → FlowNode` (`type: node.type`) and `GraphEdge → FlowEdge` (`type: edge.type`) through registries.
- **Custom nodes** (`canvas/nodes/index.ts`, 12) and **custom edges** (`canvas/edges/index.ts`, 6) are already registered. Every edge reuses `EdgePath` (`getBezierPath` + `BaseEdge` + arrow marker + hover label) — **this component is the natural home for a traveling-token animation**.
- **Views** (`lib/visualization/views.ts`): 7 views. `API_EXPLORER` exists but is **static**: ENDPOINT+MODULE nodes, EXPOSES/BELONGS_TO edges, dagre hierarchical — endpoints grouped under modules, nothing animated. `EVENT_FLOW` is an **empty-state placeholder** ("Event data not yet available").
- **Store** (`store/graph-store.ts`): Zustand slices — selection, view, filter, navigation, loading. **No animation/flow-simulation state.**
- **Layout engines** (`canvas/layout-engine.ts`): pure functions — force (seeded d3), hierarchical (dagre), radial, circular. Deterministic.
- **Detail panel** (`graph-detail-panel.tsx`): generic key/value property table; endpoint shows `httpMethod/path/parameters` as plain text. No flow view.
- **Interaction flow** (`graph-workspace.tsx`): node click → selection; double-click → drill-down neighborhood; context menu → show deps/dependents.

### 1.4 Animation capability (verified against installed code)

- React Flow v12 edges support `animated: true` (CSS dashed motion) out of the box.
- The existing `EdgePath` pattern renders raw SVG inside a `<g>` — a traveling token is a small `<circle>` positioned along the path via `path.getPointAtLength()` driven by `requestAnimationFrame`, or CSS `offset-path` — **no new library required**.
- `onlyRenderVisibleElements` (VV-004) culls off-screen edges; token animation should mutate SVG directly (rAF) and avoid per-frame React re-renders.
- VE-004 restricts visualization deps to MIT; framer-motion (MIT) is optional polish, not required.

## 2. Approaches

### Approach A — Frontend-only simulation layer (no backend changes)

Build a client-side "request flow" by walking the existing graph when an endpoint is clicked: endpoint → controller (reverse EXPOSES) → services/repos reachable via DEPENDS_ON from the controller's module; DTO chips guessed by matching parameter names against DTO node labels.

| Pros                                       | Cons                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Ships fast; zero backend/schema work       | **Fabricates** middleware/guard order and service-call sequence                            |
| Pure frontend scope (new view + animation) | DTO association is a heuristic — "plausible but wrong" is the worst outcome for a dev tool |
| Reuses existing edges and EdgePath         | Still needs the full animation infra; no data foundation for future accuracy               |

Effort: **Medium**. Risk: misleading visualization. Only acceptable if every simulated segment is visibly labeled "approximate".

### Approach B — Full backend lifecycle extraction + flow API (accurate)

1. **Parser** (`typescript-parser.ts` / `typescript-ir-builder.ts`): extract method-level decorators (`@UseGuards(JwtGuard)`, `@UsePipes`, `@UseInterceptors`) with their arguments, parameter decorators + **type annotations** (`@Body() dto: CreateUserDto`), constructor injection, and **method-body call detection** (which service methods a handler invokes).
2. **Model**: new node types (`GUARD, PIPE, INTERCEPTOR, MIDDLEWARE`) + new edge types (`PROTECTS, TRANSFORMS, INVOKES, INJECTS, CALLS`).
3. **API**: `GET /graph/:repoId/endpoints/:fqn/flow` → ordered lifecycle steps with payload types.
4. **Frontend**: new "Request Flow" view — horizontal pipeline, token travels step by step, DTO type chips ride the edges.

| Pros                                                                  | Cons                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Accurate; matches the user's vision exactly                           | Largest effort by far                                                                   |
| Data reusable everywhere (detail panel, docs, future features)        | Method-body call analysis is heuristic AST work — the hard 20% with the most edge cases |
| New node/edge types are additive (varchar+jsonb, versioned snapshots) | Enum additions ripple: DTO validation, frontend `types.ts` mirrors, filters, tests      |
|                                                                       | Old snapshots lack flow data → needs re-analysis (version bump)                         |

Effort: **High** (~60% backend, ~40% frontend).

### Approach C — Hybrid: decorator-level accuracy, honest approximation for call order

1. **Backend**: extract **only deterministic, decorator/annotation-level** data — per-endpoint guards/pipes/interceptors (with args), parameter types → DTO edges, constructor injection. **No method-body call analysis** in v1.
2. **API**: flow endpoint returns an ordered pipeline: `middleware → guards → pipes → controller handler → injected services (DI order) → repositories (reachable via imports)`. The call-tail is explicitly flagged `approximate: true`.
3. **Frontend**: same animated Request Flow view as B; the accurate prefix (middleware→handler) animates with real data, the service tail animates from DI + DEPENDS_ON reachability with a subtle "approx" visual treatment.

| Pros                                                                 | Cons                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| The 80% that matters (who guards, who pipes, DTO typing) is **real** | Intra-handler call order is still an approximation              |
| Deterministic AST work — reliable, testable                          | Two-tier accuracy needs clear UI labeling to stay honest        |
| Contained scope: one IR extension, one new endpoint, one new view    | Still touches IR + graph enums + frontend mirrors + re-analysis |
| Perfect foundation to add CALLS edges later                          |                                                                 |

Effort: **Medium-High**.

## 3. Recommendation

**Approach C (hybrid)** — highest accuracy-to-effort ratio, and the only one that honors the developer-tool honesty principle. The user's complaint is _readability_, not _lack of animation_: shipping a fabricated lifecycle (A) would repeat the same sin with motion. Method-body call analysis (B's hard tail) is genuinely hard and low-certainty; deferring it behind a labeled approximation keeps v1 shippable while building the real data foundation (guards/pipes/DTO edges) that later makes CALLS accurate.

**Suggested sequencing:**

1. Parser: method-level decorators + param types + constructor injection (`typescript-parser.ts`, `typescript-ir-builder.ts`, `decorator-role-registry.ts`, `ir-nodes.ts`).
2. Graph: new `GUARD/PIPE/INTERCEPTOR/MIDDLEWARE` node types + `PROTECTS/TRANSFORMS/INVOKES/INJECTS` edge types (`node-type.enum.ts`, `edge-type.enum.ts`, `semantic-model.builder.ts`).
3. API: `GET /graph/:repoId/endpoints/:fqn/flow` (`graph.controller.ts`, `graph-query.dto.ts`, `graph-query.service.ts`).
4. Frontend: flow types + `getEndpointFlow` API client, `Request Flow` view in `views.ts`, flow-simulation slice in `graph-store.ts`, token animation in `edge-path.tsx`, new node components, click-endpoint→play wiring in `graph-workspace.tsx`.
5. OpenSpec: extend `knowledge-graph-model` spec (new types) + `visualization-views` spec (new view row; EVENT_FLOW placeholder can be repurposed or joined by REQUEST_FLOW).

**Decision needed before proposal:** confirm whether `EVENT_FLOW` placeholder is repurposed for the request-flow view or a new view is added; confirm whether old snapshots trigger re-analysis (version bump) or flow data is best-effort-absent.

## 4. Affected Areas

**Backend**

- `src/backend/src/modules/analysis/infrastructure/parsers/typescript/typescript-parser.ts` — extract method-level decorators + parameter types
- `src/backend/src/modules/analysis/infrastructure/parsers/typescript/typescript-ir-builder.ts` — extend EndpointData/PendingClass with guards, pipes, interceptors, DI
- `src/backend/src/modules/analysis/infrastructure/parsers/decorator-role-registry.ts` — add `UsePipes`, `UseInterceptors`, `Body`, `Param`, `Query` registrations
- `src/backend/src/modules/analysis/domain/ir-nodes.ts` — `IrEndpoint` lifecycle fields, typed params, `IrClass` injection list
- `src/backend/src/modules/knowledge-graph/domain/node-type.enum.ts`, `edge-type.enum.ts` — new members
- `src/backend/src/modules/knowledge-graph/application/semantic-model.builder.ts` — map lifecycle IR → nodes/edges
- `src/backend/src/modules/knowledge-graph/application/graph-query.service.ts` + `graph.builder.ts` — flow assembly/query
- `src/backend/src/modules/knowledge-graph/infrastructure/controllers/graph.controller.ts`, `graph-query.dto.ts` — flow endpoint

**Frontend**

- `src/frontend/src/lib/visualization/types.ts` — mirror enums + `RequestFlowStep`/`RequestFlow` types
- `src/frontend/src/lib/visualization/graph-api.ts` — `getEndpointFlow()`
- `src/frontend/src/lib/visualization/store/graph-store.ts` — flow-simulation slice (playing, step index, speed)
- `src/frontend/src/components/graph/canvas/edges/edge-path.tsx` — traveling-token renderer
- `src/frontend/src/components/graph/canvas/nodes/*` + `node-style.ts` — Guard/Pipe/Interceptor/Middleware nodes
- `src/frontend/src/lib/visualization/views.ts` — Request Flow view config
- `src/frontend/src/components/graph/graph-workspace.tsx` — endpoint click → play flow
- `src/frontend/src/components/graph/graph-detail-panel.tsx` — flow step details

**Specs**: `openspec/specs/knowledge-graph-model/spec.md`, `openspec/specs/visualization-views/spec.md`, `openspec/specs/intermediate-representation/spec.md`, `openspec/specs/typescript-parser/spec.md`.

## 5. Risks

- **Enum ripple**: new `NodeType`/`EdgeType` members are mirrored in frontend `types.ts`, validated by DTOs, and enumerated by filter chips — all must move together or filters/tests break (backward-compatible per snapshot, since enums are additive).
- **Re-analysis required**: old snapshots won't contain flow data; decide between bumping graph version (re-analyze) or best-effort absent flow UI.
- **Method-body analysis scope creep** (only if B chosen): call detection is heuristic; keep it out of v1.
- **Animation perf**: `onlyRenderVisibleElements` + per-frame React re-renders conflict; token animation MUST be rAF/SVG-direct, not React state per frame.
- **Honesty of approximation**: unlabeled simulated segments would mislead — the `approximate` flag must be visually explicit.
- **Parser edge cases**: NestJS guards registered globally (`APP_GUARD`), decorator factories with complex args, `@UseGuards(GuardA, GuardB)` multi-arg forms need careful handling.

## 6. Ready for Proposal

**Yes** — approaches and tradeoffs are scoped against verified code. Proposal should pin: approach C (hybrid), view placement decision (repurpose EVENT_FLOW vs new view), and the re-analysis policy for existing snapshots.
