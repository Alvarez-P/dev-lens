# Proposal: AI Enrichment Pipeline (MVP)

## Intent

First concrete AI implementation in DevLens (zero LLM SDKs today). Enrich the Knowledge Graph with LLM-classified roles, lifecycles, DTO types, and framework/architecture detection — replacing fragile heuristics verified in `openspec/changes/ai-lifecycle-analysis/exploration.md` (NestJS-only decorator registry, name-guessing, no framework detection). Follows exploration **Option B + C**: AI as a separate additive enrichment stage over reliable structural IR, with per-unit deterministic fallback.

## Scope

### In Scope (MVP — minimal AI infra, one capability)

- `modules/ai/{domain,application,infrastructure}` DDD scaffold
- `AIProvider` interface + OpenAI + Ollama (dev) + Mock (CI) adapters
- `ai:` config section in `configuration.ts` + `.env.example`
- Context assembler: reads via `GraphQueryService` (KG-first), builds signature-level `CodeSketch` from IR
- Prompt builder: versioned templates, token budget ≤6000, XML-delimiter injection defenses
- Output validation: class-validator DTOs, schema + referential-integrity + confidence gates
- `ai-enrichment` BullMQ queue + worker on `analysis.completed` (knowledge-graph pattern)
- Cache: content-addressed by file sha256 (`FileManifestService`)
- Per-framework format configs: `ai/frameworks/{nestjs,express}.json`
- Deterministic fallback: AI off/fails → heuristics + `UNKNOWN` unchanged
- `sourceFile` on graph nodes (Gap G1 — needed for sketches)

### Out of Scope (deferred to EPIC-008)

SSE/WebSocket, CapabilityRegistry, ProviderRouter (health/cost), frontend AI panel, rate limiting, AIObserver/metrics (lightweight logging only), Anthropic adapter, Redis context cache (in-memory + manifest skip for MVP).

## Capabilities

### New Capabilities

- `ai-provider-abstraction`: provider interface, adapters, `ai:` config
- `ai-context-assembly`: KG retrieval, CodeSketch builder, sha256 cache
- `ai-prompt-management`: versioned templates, budget, injection defenses, framework configs
- `ai-enrichment-pipeline`: queue/worker, output DTOs, validation gates, fallback, semantic-model merge

### Modified Capabilities

- `knowledge-graph-model`: persist `sourceFile` on nodes (Gap G1)

## Approach

`analysis.completed` → `ai-enrichment` worker → assemble KG+IR context (XML-delimited sketches) → build prompt (per-framework config) → provider call → validate (schema → referential → confidence) → persist `IrEnrichment`; `KnowledgeGraphService` merges into semantic model. **RFC-009 §14 amendment**: code SIGNATURES only (never bodies), XML-isolated as untrusted data, `.env*` deny-list. Disabled → stage skipped; deterministic pipeline untouched.

## Affected Areas

| Area                                                      | Impact   | Description                       |
| --------------------------------------------------------- | -------- | --------------------------------- |
| `src/backend/src/modules/ai/`                             | New      | AI bounded context                |
| `config/configuration.ts`, `.env.example`                 | Modified | `ai:` section                     |
| `app.module.ts`                                           | Modified | Import `AiModule`                 |
| `knowledge-graph/domain/graph-node.vo.ts` + entity/repo   | Modified | `sourceFile` (nullable, additive) |
| `semantic-model.builder.ts`, `knowledge-graph.service.ts` | Modified | Merge enrichment                  |
| `file-manifest.service.ts`                                | Reused   | sha256 cache keys                 |
| `ai/frameworks/nestjs.json`, `express.json`               | New      | Format configs                    |

## Risks

| Risk                                     | Likelihood | Mitigation                                                |
| ---------------------------------------- | ---------- | --------------------------------------------------------- |
| §14 override (code to provider) exposure | High       | Signatures only, XML isolation, deny-list, RFC amendment  |
| Secrets exfiltration                     | Med        | `.env*` deny-list + source-extension allow-list           |
| LLM non-determinism in CI                | Med        | Mock provider + golden fixtures; CI never hits live APIs  |
| Hallucinated references                  | Med        | Referential + confidence gates; never persist unvalidated |
| Latency/cost per sync                    | Med        | sha256 cache, incremental skip, per-module batching       |

## Rollback Plan

`ai.enabled=false` disables the stage — no jobs enqueued. `ai` module, config, and `sourceFile` (nullable) are additive: revert = remove module/config, drop column. No destructive migrations.

## Dependencies

- New dep: `openai` only (Ollama via fetch, Mock zero-dep)
- Coordinate node/edge types with `request-flow-visualization` (avoid duplicate graph contracts)

## Success Criteria

- [ ] Enrichment passes class-validator schema + referential-integrity gates before persistence
- [ ] `ai.enabled=false` / provider failure → analysis/KG behavior unchanged (deterministic fallback)
- [ ] Roles/lifecycle/DTO/framework classifications on graph nodes (NestJS + Express fixtures)
- [ ] CI green on Mock provider, zero live API calls
- [ ] Existing deterministic analysis pipeline unmodified
