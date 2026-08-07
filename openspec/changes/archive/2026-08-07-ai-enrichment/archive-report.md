# Archive Report — AI Enrichment Pipeline (MVP)

**Change:** `ai-enrichment`
**Archived:** 2026-08-07
**Delivery:** feature-branch-chain — 4 PRs (#8, #5, #6, #7), all merged to `main`
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (4 new capability specs + 1 modified)

---

## Completion Summary

| Metric         | Value                                     |
| -------------- | ----------------------------------------- |
| Status         | **COMPLETED**                             |
| Commits        | 31 (PR #8 → #5 → #6 → #7 merged to main)  |
| Tasks          | 23 across 5 phases (all `[x]`)            |
| Unit tests     | 721 passing (92 suites)                   |
| Type check     | ✅ `tsc --noEmit` clean                   |
| Build          | ✅ `nest build` exit 0                    |
| Lint           | ✅ 0 errors, 0 warnings (changed files)   |
| Compliance     | ✅ All 64 scenarios compliant, 0 failures |
| Verify verdict | **PASS**                                  |

> Note: this change has no `verify-report.md` in the archive folder — the verification
> verdict and scenario counts were recorded in the apply-progress completion block and
> confirmed by the orchestrator (721 tests, 0 failures, all 64 scenarios compliant).

## Capabilities Delivered

| Domain                  | Spec file (global)                               | Action  |
| ----------------------- | ------------------------------------------------ | ------- |
| ai-provider-abstraction | `openspec/specs/ai-provider-abstraction/spec.md` | Created |
| ai-context-assembly     | `openspec/specs/ai-context-assembly/spec.md`     | Created |
| ai-prompt-management    | `openspec/specs/ai-prompt-management/spec.md`    | Created |
| ai-enrichment-pipeline  | `openspec/specs/ai-enrichment-pipeline/spec.md`  | Created |
| knowledge-graph-model   | `openspec/specs/knowledge-graph-model/spec.md`   | Updated |

### Delta sync summary

| Domain                  | Action  | Details                                                                                                    |
| ----------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| ai-provider-abstraction | Created | 6 requirements copied as full spec                                                                         |
| ai-context-assembly     | Created | full spec copied (6 requirements)                                                                          |
| ai-prompt-management    | Created | full spec copied (6 requirements)                                                                          |
| ai-enrichment-pipeline  | Created | full spec copied (9 requirements)                                                                          |
| knowledge-graph-model   | Updated | **+2 added** requirements (`sourceFile` tracking, migration reversibility); 7 existing preserved → 9 total |

Merge method: delta spec for `knowledge-graph-model` contained 2 `ADDED Requirements`
(no MODIFIED/REMOVED) — appended to the main spec's Requirements section, all existing
requirements preserved, provenance header annotated (`Updated by: ai-enrichment`).

## What Was Built

A new `ai` bounded context (MVP — first AI implementation in DevLens) that enriches the
Knowledge Graph with LLM-classified roles, lifecycles, DTO types, and framework/architecture
detection, following exploration **Option B + C** (separate additive enrichment stage with
per-unit deterministic fallback):

1. **KG foundation (PR #8)**: nullable `source_file TEXT NULL` column on `graph_nodes`
   (additive migration `1786147200000-AddSourceFileToGraphNodes`), `sourceFile` on
   `GraphNode` VO create/reconstitute/toJSON, propagation in `graph.builder.ts`,
   `getNodesByFile` in `GraphQueryService`.
2. **AI domain + config + provider abstraction (PR #5)**: `ai:` config section, `AIProvider`
   interface (complete/streamComplete/healthCheck/estimateCost/enrich), `AIRequest`/
   `AIResponse`/`AIChunk`/`AIEnrichmentRequest`/`AIEnrichmentResponse` VOs, `BaseAIError` +
   6 typed errors, OpenAI (SDK) / Ollama (fetch) / Mock (fixture) adapters,
   `ProviderSelectorService` fallback, `AI_PROVIDER_REGISTRY` token injection.
3. **Context assembly + prompt management (PR #6)**: `CodeSketchBuilder` (signatures only,
   ≤4000 tokens/sketch, allow/deny-list `.ts/.tsx` vs `.env*`), `ContextAssembler`
   (KG+IR only, ≤5000 budget, sha256 cache), versioned templates
   (`ai/capabilities/classify-lifecycle/v1/`), `PromptBuilder` (XML `<code>` isolation,
   6000 budget, framework configs nestjs.json/express.json).
4. **Pipeline + merge + docs (PR #7)**: `ai-enrichment` BullMQ queue + worker (3 attempts,
   backoff, DLQ), `EnrichmentEventHandler` on `analysis.completed` gated by `ai.enabled`,
   `ThreeGatesValidator` (schema → referential → confidence ≥0.7), `EnrichmentService`
   7-stage orchestration, `IrEnrichment` persistence (unique analysis_id), KG merge
   (`resolveClassType` AI override, GUARD/PIPE/INTERCEPTOR/MIDDLEWARE nodes,
   PROTECTS/TRANSFORMS edges), RFC-009 §14 amendment (signatures-only override).

## Key Decisions (from design.md)

1. **Separate enrichment stage (Option B)** — zero regression risk, re-runnable without
   re-parsing, matches `KnowledgeGraphModule` pattern, RFC-001 "Deterministic Before Intelligent".
2. **class-validator** for output validation — zero new deps, already used for DTOs.
3. **openai SDK only** — single new dep; Ollama via fetch (zero-deps), Mock zero-deps.
4. **In-memory Map cache** for sketches (Redis deferred to EPIC-008) — sha256 cache keys via
   `FileManifestService`.
5. **Dedicated `TEXT NULL` column** for `sourceFile` (not jsonb) — additive, queryable directly.
6. **Token-based provider registry** (`AI_PROVIDER_REGISTRY`) — mirrors `PARSER_REGISTRY`
   pattern; new providers = register another `@Injectable()` adapter.

## Deviations (documented during apply)

1. **`properties.filePath` merge kept** alongside the dedicated `source_file` column — frontend
   `filter.ts` derives architectural layers from `properties.filePath`; spec requires backward compat.
2. **Circular module deps via `forwardRef`** — AiModule ↔ KnowledgeGraphModule (query + merge).
3. **`computeManifestSha256` composite** — spec said "from FileManifestService" but only per-file
   hashes existed; added deterministic composite hash (sorted `path\u0000hash` entries) as cache key.
4. **Schema retry once with feedback** — Gate 1 failure appends validation errors to the prompt
   and re-calls; second failure aborts to deterministic fallback.
5. **`enrichment.failed` only on final attempt** — matches REQ-EP-002.
6. **Single-prompt MVP** (design OQ2 resolved) — one prompt for all sketches; per-unit fallback
   realized inside gates (`failedUnits` vs persisted units).
7. **`enrichment.skipped` reason `no_source_units`** — zero-sketch context skips instead of fails.
8. **RFC-009 §14 override** — amendment 14.1: signature-level sketches only, XML-isolated,
   deny-list, no secrets.
9. **Lifecycle FQNs** — `parseLifecycleEntry('guard:JwtGuard')` → `${classFqn}~guard:JwtGuard`;
   PROTECTS (guard), TRANSFORMS (pipe/interceptor/middleware).
10. **ACCEPTS/RETURNS edges deferred** — REQ-EP-007 table mentions them, but task 5.5 scope lists
    only PROTECTS/TRANSFORMS; coordination left to request-flow-visualization change.

## Verification Result

- **Verdict**: PASS — 721 tests (92 suites) green, 0 failures; tsc + eslint clean; build green.
- **Compliance**: all 64 scenarios compliant across the 5 delta specs.

## Follow-ups Identified

| #   | Follow-up                                         | Source                  |
| --- | ------------------------------------------------- | ----------------------- |
| 1   | ACCEPTS/RETURNS edges for DTO types               | REQ-EP-007 / RFV change |
| 2   | Redis context cache (in-memory Map now)           | design decision 4       |
| 3   | CapabilityRegistry + ProviderRouter (health/cost) | proposal out-of-scope   |
| 4   | Anthropic adapter, rate limiting, AIObserver      | proposal out-of-scope   |
| 5   | Frontend AI panel (SSE/WebSocket)                 | proposal out-of-scope   |

## Artifacts in This Archive

- `proposal.md` — intent, scope (MVP), approach (Option B + C), risks, rollback, success criteria
- `design.md` — architecture decisions, data flow, file changes, per-phase design
- `tasks.md` — 23 tasks across 5 phases (all `[x]`)
- `apply-progress.md` — per-PR TDD evidence (PR 1–4), deviations, gotchas, completion block
- `specs/` — 5 delta specs (ai-provider-abstraction, ai-context-assembly, ai-prompt-management, ai-enrichment-pipeline, knowledge-graph-model)
- `archive-report.md` — this report

## Next Steps

- Downstream EPIC-008 (ai-orchestration) and `request-flow-visualization` can consume the synced
  `openspec/specs/ai-*` and updated `knowledge-graph-model` capabilities.
- Address follow-ups #1–#5 in small follow-up changes.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth is
synced to `openspec/specs/`. Ready for the next change.
