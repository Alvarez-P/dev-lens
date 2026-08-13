# Proposal: EPIC-008 — AI Orchestration Platform

## Intent

Build the AI runtime for DevLens: a provider-agnostic platform (context assembly, prompt management, streaming, observability, caching) turning Knowledge Graph data into grounded AI context. Without it, every capability re-implements providers, prompts, metrics (RFC-009 §2). Ships `ai-lifecycle-analysis` as first capability to prove the platform under load.

## Scope

### In Scope

- `ai` bounded context (DDD): `AIService` orchestrator, `CapabilityRegistry`, `AIProvider` interface, AI events
- Providers: OpenAI (cloud) + Ollama (local) + mock (CI). Anthropic deferred
- Context assembler over `GraphQueryService` + Redis cache (`context:{cap}:{nodeId}:{depth}`, TTL 5m) + truncation marker
- Versioned prompt templates (`ai/capabilities/{id}/v{n}/`), token budget ≤6000
- Output validation: class-validator DTOs; JSONSchema/ajv deferred
- SSE streaming endpoint + cancellation; `ai:` config section
- Observability: per-request metrics + 4 AI events
- Frontend AI panel on graph detail panel (SSE, progressive tokens)
- KG `sourceFile` on nodes (G1 fix)

### Out of Scope

- WebSocket/conversation, rate limits/quotas/tier gating, aggregated dashboards, A/B, semantic caching
- Anthropic adapter, secrets manager, `explain-event`/`analyze-impact`/`review-architecture`

## Capabilities

### New

- `ai-provider-abstraction`: provider interface, selection, fallback
- `ai-capability-framework`: capability defs, registry, output formats, validation rules
- `ai-context-assembly`: KG retrieval, truncation, caching
- `ai-prompt-management`: versioned templates, token budget, injection defenses
- `ai-streaming`: SSE transport, chunk contract, cancellation
- `ai-observability`: request metrics + domain events

### Modified

- `knowledge-graph-model`: persist `sourceFile` path on nodes (needed by ai-lifecycle-analysis signatures)

## Approach

Platform-first (exploration Approach B): build runtime, prove with one capability. RFC-001 deterministic-before-intelligent: KG is primary context. **RFC-009 §14 amendment**: code SIGNATURES (never bodies) may be sent to providers — XML-delimited, strict output schema, system prompt treats code as untrusted data, `.env*` deny-list. Chained PRs (400-line budget).

## Affected Areas

| Area                                          | Impact   | Description              |
| --------------------------------------------- | -------- | ------------------------ |
| `src/backend/src/modules/ai/`                 | New      | AI bounded context       |
| `config/configuration.ts`, `.env.example`     | Modified | `ai:` section            |
| `knowledge-graph/` entity+repository          | Modified | `sourceFile` persistence |
| `graph-detail-panel.tsx`, `lib/api-client.ts` | Modified | AI panel + SSE client    |
| `package.json`                                | Modified | + `openai`               |

## Risks

| Risk                               | Likelihood | Mitigation                                               |
| ---------------------------------- | ---------- | -------------------------------------------------------- |
| §14 override exposure              | High       | Signatures only, XML isolation, deny-list, RFC amendment |
| Secrets exfiltration               | Med        | `.env*` deny-list, source-extension allow-list           |
| LLM non-determinism in CI          | Med        | Mock provider + golden fixtures; CI never hits live APIs |
| SSE buffered by interceptors/proxy | Med        | Early verify `@Sse()` vs CORS/interceptors               |
| KG enum ripple (lifecycle/DTO)     | Med        | ai-lifecycle-analysis owns deltas; request-flow after    |

## Rollback Plan

Disable via `ai.enabled=false`; feature-flag AI panel. `ai` module + `sourceFile` column are additive — revert = remove module/config, drop column. No destructive migrations.

## Dependencies

- EPIC-001/002/005/006/007 complete (KG query API archived 2026-08-04)
- New dep: `openai` only (fetch-based Anthropic adapter later)
- Sequencing: EPIC-008 → `ai-lifecycle-analysis` → `request-flow-visualization`

## Success Criteria

- [ ] New capability added with zero orchestrator/provider changes
- [ ] KG-grounded responses stream over SSE with cancellation
- [ ] CI e2e passes on mock provider (no live APIs)
- [ ] Context assembly <200ms; cache hit <10ms (RFC-009 §13)
- [ ] `ai-lifecycle-analysis` enrichments pass schema + referential-integrity gates
