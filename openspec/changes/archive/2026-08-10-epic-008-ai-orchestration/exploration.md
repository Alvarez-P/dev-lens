# Exploration: EPIC-008 — AI Orchestration

> Phase: sdd-explore | Date: 2026-08-06 | Mode: openspec
> Change folder: `openspec/changes/epic-008-ai-orchestration/`
> Sources: RFC-009 (AI Orchestration), RFC-010 (AI Architecture),
> EPIC-008 (product epic), verified against `src/backend` and `src/frontend` code.
> Related in-flight change: `ai-lifecycle-analysis` (exploration only, candidate first capability).

---

## 1. Current State — What Infrastructure Exists That EPIC-008 Can Reuse

### 1.1 Reusable assets (all verified in code)

| Asset                                              | Location                                                                                                                                                                                                                                                                                    | Reuse for EPIC-008                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| BullMQ queues + DLQ pattern                        | `repositories` (`repository-sync`, `repository-clone`), `analysis` (+`analysis-dlq`), `knowledge-graph` (+`knowledge-graph-dlq`)                                                                                                                                                            | New `ai-enrichment` queue + DLQ; identical retry (3 attempts) / exponential backoff (1000ms) / DLQ-on-final-failure pattern                |
| Redis (ioredis 5.4.1)                              | `BullModule.forRootAsync` in `app.module.ts` (via `ConfigService.redis.url`)                                                                                                                                                                                                                | Context cache (RFC-009 §10), key `context:{capability}:{node_id}:{depth}`, TTL 5 min                                                       |
| Domain events                                      | `InMemoryDomainEventDispatcher` (`shared/domain/domain-event-dispatcher.ts`); modules register handlers in `onModuleInit`                                                                                                                                                                   | `AIRequestStarted/Completed/Failed/Cancelled` events; chain `ai-enrichment` off `knowledge-graph.updated` / `analysis.completed`           |
| class-validator + class-transformer (0.14.1/0.5.1) | global `ValidationPipe` in `main.ts` (whitelist, forbidNonWhitelisted, transform); `CustomValidationPipe` in `shared/infrastructure/pipes/`                                                                                                                                                 | Post-LLM output validation (RFC-010 §5.5). **Note**: no zod/ajv/JSONSchema lib installed — v1 choice = class-validator DTOs (see §5 below) |
| Typed ConfigService                                | `src/backend/src/config/configuration.ts` (`AppConfiguration` interface + env factory)                                                                                                                                                                                                      | Add `ai:` section (providers, default_model, enabled, timeouts) + `.env.example` keys                                                      |
| Knowledge Graph query API                          | `GraphQueryService` (application layer, **exported** from `KnowledgeGraphModule`): `getLatestGraphSnapshot`, `getNodes` (type-filter, paginated), `getNodeWithEdges` (FQN, direction), `getEdges`, `findAllNodesAndEdges`, static helpers `getNeighborhood`/`getNodesByType`/`getNodeByFqn` | Direct dependency for the Context Assembler (RFC-009 §6) — service-level, not HTTP                                                         |
| HTTP graph API (auth pattern)                      | `GraphController`: `GET /api/v1/graph/:repoId[/export                                                                                                                                                                                                                                       | /nodes                                                                                                                                     | /nodes/:fqn | /edges]`, guarded by `JwtAuthGuard + RepoMembershipGuard` | Template for the AI controller guard pattern; repo-scoping precedent |
| Analysis IR with file paths                        | `AnalysisRepository` (**exported** from `AnalysisModule`); `analysis.ir` jsonb holds `IrModule.path`, class/endpoint structure                                                                                                                                                              | Context source beyond graph; FQN → source file mapping (see Gap G1)                                                                        |
| Auth/guard primitives                              | `shared/infrastructure/guards/auth.guard.ts`, `JwtAuthGuard`, `RepoMembershipGuard`, `current-user.decorator.ts`                                                                                                                                                                            | AI endpoints reuse JWT + repo-membership scoping                                                                                           |
| Frontend fetch client                              | `src/frontend/src/lib/api-client.ts` (fetch + `AbortSignal` support, `combineAbortSignals`, 30s default timeout)                                                                                                                                                                            | Cancellation for streaming; needs a streaming/SSE variant (see §6)                                                                         |
| Graph detail panel UI                              | `src/frontend/src/components/graph/graph-detail-panel.tsx` (right-side w-80 panel on node selection)                                                                                                                                                                                        | Natural attach point for an "Explain" AI surface                                                                                           |

### 1.2 What does NOT exist yet (greenfield for EPIC-008)

- **No LLM SDKs**: `src/backend/package.json` has no `openai`, `@anthropic-ai/sdk`, `langchain`, or zod/ajv/joi.
- **No AI config** section in `configuration.ts`.
- **No SSE / WebSocket infrastructure** — zero `@Sse()`, `EventSource`, or socket usage across backend and frontend.
- **No rate limiting / throttling** (`@nestjs/throttler` absent) and **no tier model**: `Role` enum is only `OWNER/ADMIN/MEMBER/VIEWER` (org RBAC), NOT RFC-010 §9's Free/Professional/Enterprise tiers.
- **No metrics/observability** infra (no Prometheus client; only pino logging + per-request pino logs).
- **No secrets manager** — provider API keys would live in `.env` (RFC-009 §14 mandates a secrets manager; MVP tradeoff).
- **No AI UI** in the frontend (no panel, no streaming renderer, no AI store slice).

### 1.3 Knowledge Graph data model (what the Context Assembler can query today)

- `NodeType` (13): PROJECT, PACKAGE, MODULE, CONTROLLER, SERVICE, REPOSITORY, ENTITY, DTO, INTERFACE, ENDPOINT, EXTERNAL_DEPENDENCY, UNKNOWN. _(In-flight change `request-flow-visualization` adds GUARD, PIPE, INTERCEPTOR, MIDDLEWARE.)_
- `EdgeType` (6): BELONGS_TO, IMPLEMENTS, EXTENDS, IMPORTS, DEPENDS_ON, EXPOSES. _(In-flight adds PROTECTS, TRANSFORMS, INVOKES, INJECTS.)_
- Node `properties` (jsonb): Project → `{language, rootPath}`; Class → `{isAbstract, isExported, role?}`; Endpoint → `{httpMethod, path}`; Interface → `{isExported}`. **Sparse** — no method names, no DTO field types, no framework.
- Graph snapshots are **versioned** per analysis (`version = latest+1`, deprecated nodes retained) — context assembly can pin to a version; `GraphUpdatedEvent` (`knowledge-graph.updated`) fires on each build.
- **Gap G1 — `sourceFile` is NOT persisted**: `SemanticNode.sourceFile` is dropped in `graph.repository.nodeToEntity()` (`GraphNodeEntity` has no file column). FQN → source-path mapping is only reachable via `analysis.ir`. Context assembler must inject `AnalysisRepository` (exported) or properties must carry the path.

---

## 2. Module Structure — Where the `ai` Bounded Context Fits

Follow the existing DDD context convention (`modules/{context}/{application,domain,infrastructure}`), mirroring `analysis`/`knowledge-graph`:

```
src/backend/src/modules/ai/
├── ai.module.ts                 # registers queues, providers, controller; onModuleInit → event handlers
├── ai.tokens.ts                 # AI_QUEUE, AI_DLQ, AI_PROVIDER_REGISTRY, CAPABILITY_REGISTRY tokens
├── domain/
│   ├── ai-provider.interface.ts # RFC-010 §6.1: complete/streamComplete/healthCheck/estimateCost
│   ├── ai-capability.ts         # RFC-010 §5.1: id/name/version/tier/contextStrategy/promptTemplate/outputFormat/validationRules
│   ├── capability-registry.interface.ts
│   ├── context-strategy.ts      # targetNodeType, relationshipDepth, includeDependents/Dependencies/ApiSurface/EventSurface/DomainContext, maxContextTokens
│   ├── prompt-template.ts       # systemInstruction, contextPlaceholder, userQueryWrapper, capabilityInstructions, examples?
│   ├── ai-errors.ts             # provider/context/user-facing error taxonomy (RFC-009 §12)
│   ├── ai-events.ts             # AIRequestStarted/Completed/Failed/Cancelled
│   └── output/                  # per-capability output DTOs + class-validator rules (v1)
├── application/
│   ├── ai.service.ts            # the orchestrator (RFC-009 §5.2 singleton pipeline)
│   ├── capability-registry.service.ts
│   ├── context-assembler.service.ts   # queries GraphQueryService (+ AnalysisRepository for G1); truncation (§6.3)
│   ├── prompt-builder.service.ts      # template merge + token budget enforcement (≤6000, §7.2)
│   ├── provider-router.service.ts     # selection/fallback (§6.4)
│   └── ai-observer.service.ts         # per-request metrics + event dispatch (§9)
└── infrastructure/
    ├── providers/               # openai.provider.ts, anthropic.provider.ts, ollama.provider.ts
    ├── controllers/             # ai.controller.ts — POST invoke + @Sse() stream endpoint
    ├── jobs/                    # ai-enrichment.job-processor.ts (batch pipeline for ai-lifecycle-analysis)
    ├── events/                  # ai-event-handler.ts (chain off knowledge-graph.updated if enrichment is wired)
    ├── cache/                   # context-cache.service.ts (ioredis)
    └── templates/               # ai/capabilities/{id}/v{n}/system.md|instructions.md|examples.json (RFC-010 §8.1)
```

**Wiring changes**:

- `app.module.ts` — add `AiModule` alongside `KnowledgeGraphModule`.
- `configuration.ts` + `AppConfiguration` + `.env.example` — `ai:` section (providers: enabled/api_key_secret/base_url/default_model; default_provider; cache TTL; streaming timeouts).
- `KnowledgeGraphModule` already exports `GraphQueryService`; `AnalysisModule` already exports `AnalysisRepository` — no export changes needed.
- **Cross-cutting note**: no new gateway/SSE infra required — NestJS `@Sse()` is native to `@nestjs/platform-express` (already installed); WebSocket gateway would need `@nestjs/websockets` + `@nestjs/platform-socket.io` (defer).

---

## 3. Dependencies — What's Ready, What Needs Work First

### 3.1 Ready now

- **EPIC-006 Knowledge Graph**: **archived** (2026-08-04) — query API implemented and spec-merged (`openspec/specs/knowledge-graph-query-api`). `GraphQueryService` is functional and exported. **Ready.**
- **Graph data sufficiency** for structural explanations: PROJECT/MODULE/SERVICE/CONTROLLER/ENDPOINT/DTO/ENTITY nodes + BELONGS_TO/EXPOSES/DEPENDS_ON/IMPORTS/EXTENDS/IMPLEMENTS edges give enough for `explain-module`, `explain-service`, `explain-architecture`, `explain-dependency`, `explain-endpoint` at a **structural level**. `explain-event` is NOT supportable yet (no event nodes/edges in the graph today — EVENT_FLOW is deferred in `request-flow-visualization`). `suggest-documentation`/`analyze-impact`/`review-architecture` are weak on current data (no methods, no DTO field types, no framework).
- **Queue/Redis/events/validation/config**: all present and proven (see §1.1).

### 3.2 Needs work / decisions first

- **D1 — New deps**: `openai` + `@anthropic-ai/sdk` (or minimal fetch-based adapters to honor RFC-001 minimal-deps; SDKs buy native streaming/chunk parsing). No validator lib needed for v1 (class-validator). No SSE lib needed.
- **D2 — RFC-009 §14 policy conflict (user decision)**: §14 forbids raw source code to providers. `ai-lifecycle-analysis` (the desired first capability) **requires signature-level code sketches**. This is an explicit, deliberate override needing user sign-off + RFC amendment note (already flagged in `ai-lifecycle-analysis/exploration.md` §10.1). If the override is rejected, the first capability becomes a KG-only `explain-*` capability.
- **D3 — Tier model missing**: RFC-010 §9 capability gating (Free/Professional/Enterprise) and RFC-009 §11 rate limits/quotas have **no backing model** in identity (only org Roles). Recommend **deferring** gating/quota/rate-limit stories; MVP exposes all capabilities to authenticated repo members (or a single hardcoded "tier: free" gate).
- **D4 — Secrets**: no secrets manager exists. MVP uses `.env` keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`); note the deviation, document as MVP tradeoff.
- **D5 — Coordination with in-flight `request-flow-visualization`** (has proposal/design/specs, NOT archived): it is modifying the **same** KG model (node/edge enums) and IR (lifecycle fields) that `ai-lifecycle-analysis` also touches (ACCEPTS/RETURNS edges, DTO fields). Sequence: either ship request-flow first (deterministic v1) then let AI enrich on top, or fold AI into its model deltas. **Two implementations of the same graph contract must be avoided.**
- **D6 — sourceFile gap (G1)**: context assembler needs `AnalysisRepository` injection to resolve FQN → source path for any capability that references code files (ai-lifecycle-analysis sketches, explain-* line references).
- **D7 — Graph data enrichment loop**: AI context quality depends on graph data, and `ai-lifecycle-analysis` would improve graph data — circular by design. MVP must set honest expectations on explanation depth with today's sparse properties.

---

## 4. MVP Scope Recommendation

### 4.1 Recommended MVP (platform + first capability)

**Build the platform core, not the full RFC surface:**

1. **`ai` module scaffold** — config section, `AIProvider` interface, `CapabilityRegistry`, `AIService` orchestrator pipeline (router → context assembler → prompt builder → provider → observer), `ai-events`.
2. **Two providers**: **OpenAI** (cloud default) + **Ollama** (local; deterministic dev/test, zero cost, CI-safe with a mock provider). Anthropic adapter is a small third — **defer** or include if trivial; RFC-010 lists it as default but OpenAI + Ollama prove the interface.
3. **Context Assembler** over `GraphQueryService` with RFC-009 §6.3 truncation (direct-over-transitive priority, explicit `truncated` marker) + Redis context cache (`context:{capability}:{nodeId}:{depth}`, 5 min TTL).
4. **Prompt Management**: versioned template files per RFC-010 §8.1 (`ai/capabilities/{id}/v1/`), `PromptBuilder` with token budget enforcement (≤6000).
5. **Output validation**: class-validator DTOs (zero-dep) — pin this in the spec; JSONSchema/ajv later.
6. **Streaming**: one `@Sse()` endpoint (`POST /api/v1/ai/:capability/stream` or `GET /stream?requestId=`) emitting `{type: token|done|error}` chunks + cancellation via AbortSignal. **Defer WebSocket** (conversation) — SSE-only for MVP.
7. **Observability**: `AIObserver` per-request metrics (latency, ttft, tokens, cost estimate, success) + the four AI events. **Defer** aggregated metrics dashboards.
8. **Frontend**: minimal AI panel — an "Explain" entry on the graph detail panel consuming the SSE stream with progressive token rendering + cancel. Reuse `api-client.ts` with a streaming variant.

**First capability — decision point (user):**

- **Path A (recommended if override accepted): `ai-lifecycle-analysis`** — the already-explored batch enrichment pipeline (`ai-lifecycle-analysis/exploration.md`, Option B+C: separate `ai-enrichment` BullMQ stage with deterministic fallback). Proves platform under load, feeds the graph, but needs D2 override + D5 sequencing.
- **Path B (if override rejected): `explain-service` (or `explain-module`)** — pure KG context, full interactive streaming loop end-to-end, no policy override. Weaker platform stress-test (no queue stage).

Either path must ship with a **mock provider** for tests + golden-fixture evaluation tests (RFC-010 §11) — CI must never hit live LLM APIs.

### 4.2 Explicitly deferred (later stories)

- Multi-tenancy quotas + rate limiting (RFC-009 §11) — blocked by missing tier model (D3).
- WebSocket/conversation, session isolation, follow-ups.
- A/B testing, semantic response caching.
- `explain-event`, `analyze-impact`, `review-architecture`, `onboard-developer`, `summarize-changes` — data/model or tier-gated.
- Aggregated metrics dashboards; secrets-manager integration (MVP = `.env`).

### 4.3 Approaches compared

| Approach                                                      | Pros                                                                                                          | Cons                                                                                                            | Effort    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| **A. Platform + KG-only `explain-*` first**                   | No RFC override; full streaming loop proven; smallest risk surface                                            | Doesn't exercise queue/batch; weaker platform proof; graph data sparse today                                    | Medium    |
| **B. Platform + `ai-lifecycle-analysis` first (recommended)** | Matches user intent; proves queue+provider+cache+validation under load; feeds graph (improves future context) | Requires D2 override decision; D5 sequencing vs request-flow; more moving parts                                 | High      |
| **C. Full RFC-009/010 surface in one epic**                   | RFC completeness                                                                                              | Tier model, secrets manager, WebSocket, metrics dashboards don't exist; enormous scope; high review-budget risk | Very High |

---

## 5. Output Validation Choice (repeated from `ai-lifecycle-analysis` exploration — aligns)

- **v1: class-validator DTOs** — zero new deps, matches codebase convention, already proven in `graph-query.dto.ts`.
- **Later: ajv/JSONSchema** — RFC-010 standardizes `OutputFormat.schema` as JSONSchema; frontend can reuse the schema. Migrate when schemas grow nested/recursive (per-framework formats, lifecycle steps).
- Spec should pin the validator choice to avoid option-paralysis.

---

## 6. Frontend Implications

- **No AI UI exists** — greenfield. Natural attach: `graph-detail-panel.tsx` (add "Explain" action) or a dedicated drawer/route `repositories/[id]/ai`.
- **Streaming transport**: native browser `EventSource` for GET or `fetch` + `ReadableStream` for POST body. `api-client.ts` currently: 30s default timeout (fine for SSE if it streams and resets, but **the `AbortController` timeout kills long-lived streams** — the streaming client MUST bypass/disable the timeout, e.g. `timeout: 0` or a dedicated `stream()` path). `combineAbortSignals` already exists for cancellation.
- State: Zustand slice for streamed text/chunks per capability (`ai-store.ts`) mirrors the existing `graph-store.ts` pattern; TanStack Query is a poor fit for token streams (use store + local effects).
- `@xyflow/react` graph is the context surface — selecting a node gives `repoId + nodeId/fqn` → AI request payload.

---

## 7. Risks

1. **Policy tension (explicit user decision needed)**: `ai-lifecycle-analysis` sends code (signature sketches) to providers, overriding RFC-009 §14 ("no raw source code, never for MVP"). Must be a documented RFC amendment scoped to sketches (never full bodies), or switch to Path B.
2. **Secrets exfiltration**: repos may contain `.env`/credentials; `IGNORED_DIRECTORIES` doesn't exclude `.env*`. AI file selection needs an explicit deny-list; never send non-source files.
3. **LLM non-determinism in tests**: mock provider + golden fixtures mandatory; CI must never call live providers; deterministic prompts + seed-friendly config.
4. **Cost & latency**: full-repo LLM passes are expensive. Mitigate with manifest-sha256 cache (reuse `FileManifestService`), incremental enrichment (only changed files), per-module batching, local Ollama for dev.
5. **Coordination with `request-flow-visualization`**: in-flight change modifies the same KG enums/IR that `ai-lifecycle-analysis` wants (ACCEPTS/RETURNS, DTO fields). Sequence explicitly; avoid two implementations of one graph contract.
6. **Enum/model ripple**: AI output schema ↔ graph enums must move together (same warning as prior explorations).
7. **G1 — sourceFile not in graph**: context assembler must inject `AnalysisRepository` (exported) or graph persistence must carry source paths — otherwise FQN → file mapping is impossible.
8. **Streaming infra greenfield**: SSE + proxy buffering (Next.js dev proxy, reverse proxies) can break chunked responses; verify `@Sse()` with the existing `FRONTEND_URL` CORS setup and confirm no global interceptors buffer responses (`response-transform.interceptor` wraps JSON — must not swallow SSE stream events).
9. **Hallucination/groundedness**: referential-integrity + confidence gates post-validation (drop fabrications, never persist) per RFC-007 §6.4 honesty.
10. **Secrets management deviation**: `.env` keys for MVP — flag as accepted deviation from RFC-009 §14 (secrets manager).

---

## 8. Ready for Proposal

**Yes** — scope grounded in verified code. The proposal (sdd-propose) must pin:

1. **First capability decision**: Path A (`ai-lifecycle-analysis` batch enrichment, needs RFC-009 §14 override) vs Path B (`explain-*` KG-only, interactive). This is a **user decision** — surface it.
2. **Provider set**: OpenAI + Ollama (mock provider for CI); Anthropic deferred or included.
3. **MVP boundaries**: SSE streaming only (no WebSocket); defer rate limits/quotas (tier model missing), aggregated metrics, A/B, conversation.
4. **Validation**: class-validator first; JSONSchema/ajv later.
5. **Sequencing vs `request-flow-visualization`** (in-flight) and whether `ai-lifecycle-analysis` merges into EPIC-008 or stays a dependent change.
6. **New deps**: `openai` + `@anthropic-ai/sdk` (or fetch-based adapters); confirm before apply.

Suggested change granularity for sdd-propose/spec/tasks: split EPIC-008 into platform stories (ai-module-scaffold, provider-abstraction, context-assembly, prompt-management, streaming-sse, observability) + capability story (ai-lifecycle-analysis or explain-*) + frontend story (ai-panel) — sized for the 400-line review budget with chained PRs.
