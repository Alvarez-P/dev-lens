# Archive Report — EPIC-008 AI Orchestration Platform

**Change:** `epic-008-ai-orchestration`
**Archived:** 2026-08-10
**Delivery:** feature-branch-chain — 16 PRs (PR#19–25 for PR1–9, PR#26–33 for PR10–16 via tracker), all merged to `main` (final: `b8c286e`)
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (3 new domain specs + 4 merged)

---

## Completion Summary

| Metric         | Value                                |
| -------------- | ------------------------------------ |
| Status         | **COMPLETED**                        |
| Tasks          | 17 across 6 phases (all `[x]`)       |
| Backend tests  | 110 suites / 998 tests               |
| Frontend tests | 28 files / 411 tests                 |
| Playwright e2e | 3 tests                              |
| Main           | `b8c286e`                            |
| Verify verdict | **PASS** (confirmed by orchestrator) |

> Note: this change has no `verify-report.md` in the change folder — the verification
> verdict was confirmed by the orchestrator (all suites green, merged to main). No
> CRITICAL issues were reported; archiving proceeded per the phase contract.

## Delta Sync Summary

| Domain                  | Action  | Details                                                                                                                                                                                                |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ai-capability-framework | Created | 5 requirements copied as full spec (new domain)                                                                                                                                                        |
| ai-observability        | Created | 4 requirements copied as full spec (new domain)                                                                                                                                                        |
| ai-streaming            | Created | 5 requirements copied as full spec (new domain)                                                                                                                                                        |
| ai-context-assembly     | Updated | **+5 added** requirements (GraphQueryService retrieval, truncation strategy, Redis cache, ≤4000 budget, allow/deny-list); 6 existing preserved → 11 total                                              |
| ai-prompt-management    | Updated | **+5 added** (Versioned Template Storage, Template Variable Substitution, Prompt Structure, Token Budget Enforcement (Capability Prompts), Prompt Injection Defenses); 6 existing preserved → 11 total |
| ai-provider-abstraction | Updated | **+4 added** (Provider Selection Logic, Configuration-Driven Setup, Provider Fallback, Mock Provider for CI); 6 existing preserved → 10 total                                                          |
| knowledge-graph-model   | Updated | **+1 added** (Source File Persistence on Graph Nodes); **1 modified** (Graph Node Value Object — added nullable `sourceFile` field + persisted/queryable scenario); 13 existing preserved → 14 total   |

**Merge method:** delta requirements matched against main specs by name and appended (ADDED);
existing requirements preserved in full. Provenance headers annotated
(`Updated by: epic-008-ai-orchestration (2026-08-10)`) on all merged specs and
(`Archived from:`) on new specs, matching the `ai-enrichment` convention.

## Merge Judgment Calls (non-destructive, documented)

1. **ai-provider-abstraction R1 (AIProvider Interface Contract) — NOT duplicated.**
   The delta specifies a 4-method contract (`complete`/`streamComplete`/`healthCheck`/`estimateCost`).
   The main spec already carries the 5-method contract (incl. `enrich`), which remains live in the
   codebase (`enrichment.service.ts`, `provider-selector.service.ts`). The delta's 4 methods are a
   subset of the existing contract — replacing would have been destructive. The existing R1 covers
   the delta's R1 requirements; the delta's new scenarios are captured by the added requirements.
2. **ai-prompt-management "Token Budget Enforcement" — name collision resolved non-destructively.**
   Both the main spec (enrichment `PromptBuilder`, `ContextBudgetExceededError` + deterministic
   fallback — still live) and the delta (capability `PromptBuilder`, `PromptBudgetExceededError`)
   carry this title. The delta's version was appended as
   **"Token Budget Enforcement (Capability Prompts)"**; the existing requirement was preserved
   untouched.
3. **No destructive removals performed.** Config rule `archive: Warn before merging destructive
deltas` — checked; no requirement sections were removed or replaced destructively.

## What Was Built

EPIC-008 delivers the AI orchestration platform on top of the EPIC-007/ai-enrichment foundation:

1. **Domain & foundation (PR1–4)**: `AIProvider` interface + request/response/chunk VOs, `ai-errors.ts`,
   `capability-registry.interface.ts`, `AICapability` (context strategy, prompt template, output
   format, validation rules, gating), `sourceFile` on KG node VO + migration, `ai:` config section.
2. **Infrastructure (PR5–7)**: OpenAI (SDK) / Ollama (fetch) / Mock (deterministic) providers,
   Redis context cache (`context:{cap}:{nodeId}:{depth}`, TTL 5m).
3. **Application services (PR8–11)**: `CapabilityRegistry` + `ProviderRouter` (capability+health+cost
   selection, retry→fallback), `ContextAssembler` (KG retrieval, truncation marker, allow/deny-list,
   cache), `CapabilityPromptBuilder` (substitution, 4-section, ≤6000, injection defenses,
   `explain-module/v1` templates), `AIService` orchestrator (route→context→prompt→stream→observe).
4. **Transport & observability (PR12–13)**: 4 AI domain events + `AIObserver` (15 metrics, KG-updated
   cache invalidation), SSE `@Sse('stream')` controller (token/done/error chunks, cancel on close,
   sanitized errors, no interceptor buffering).
5. **Wiring (PR14)**: `ai.tokens.ts`, `ai.module.ts` (onModuleInit handlers, explain-module
   registration), mock-provider e2e.
6. **Frontend (PR15–16)**: `ai-store.ts` (chunks/status), `api-client.ts` `stream()` (POST +
   ReadableStream, timeout 0, `combineAbortSignals`), AI panel in `graph-detail-panel.tsx`
   (progressive tokens, cancel, error states), Playwright e2e.

## Verification Result

- **Verdict**: PASS — 998 backend tests (110 suites) + 411 frontend tests + 3 Playwright e2e, all green.
- All 17 tasks `[x]`, all 16 PRs merged to `main` (`b8c286e`).

## Artifacts in This Archive

- `proposal.md` — intent, scope, approach, rollback plan, success criteria
- `exploration.md` — requirements clarification
- `design.md` — architecture decisions, sequence flows, file changes
- `specs/` — 7 delta specs (3 new domains, 4 modified domains)
- `tasks.md` — 17 tasks across 6 phases (all `[x]`)
- `archive-report.md` — this report

## Next Steps

- Downstream changes can consume the synced `openspec/specs/ai-*` specs and the updated
  `knowledge-graph-model` (`sourceFile` semantics).
- Deferred per specs: tier-based capability gating (RFC-010 §9), WebSocket transport,
  aggregated metrics dashboards / Prometheus (RFC-009 §9.2).

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth is
synced to `openspec/specs/`. Ready for the next change.
