# Tasks: AI Enrichment Pipeline (MVP)

## Review Workload Forecast

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| Estimated changed lines | ~4500–6500 (src + spec)   |
| 400-line budget risk    | High                      |
| Chained PRs recommended | Yes                       |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy       | ask-on-risk               |
| Chain strategy          | pending                   |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                      | Likely PR | Notes                                                        |
| ---- | ----------------------------------------- | --------- | ------------------------------------------------------------ |
| 1    | KG sourceFile delta (Gap G1)              | PR 1      | Independent; shares node types w/ request-flow-visualization |
| 2    | AI domain + config + provider abstraction | PR 2      | MockProvider-verifiable; no pipeline                         |
| 3    | Context assembly + prompt management      | PR 3      | Needs PR 1 + Phase 2 types                                   |
| 4    | Pipeline, gates, KG merge, RFC-009        | PR 4      | Needs PR 2 + PR 3; wires app.module                          |

## Phase 1: KG Foundation (Gap G1)

- [x] 1.1 RED→GREEN: `sourceFile` on GraphNode VO create/reconstitute/toJSON (REQ-KG-001)
- [x] 1.2 GREEN: `source_file TEXT NULL` column + migration on graph-node entity (REQ-KG-001/002)
- [x] 1.3 GREEN: propagate filePath in graph.builder.ts; expose via GraphQueryService (REQ-KG-001)

## Phase 2: AI Domain + Config

- [x] 2.1 Add `ai:` section to configuration.ts + .env.example (REQ-AP-004)
- [x] 2.2 AIProvider interface + AIRequest/AIResponse/AIChunk VOs (REQ-AP-001/002)
- [x] 2.3 BaseAIError + 6 typed errors (REQ-AP-005)
- [x] 2.4 IrEnrichment + AIClassifiedRole + CodeSketch VOs (REQ-EP-005, REQ-CA-002)
- [x] 2.5 Enrichment events + ai.tokens.ts + AiModule queue scaffold (REQ-EP-002/008)

## Phase 3: Provider Abstraction

- [x] 3.1 RED→GREEN: OpenAIProvider via openai SDK (REQ-AP-003)
- [x] 3.2 RED→GREEN: OllamaProvider fetch /api/generate + healthCheck (REQ-AP-003)
- [x] 3.3 RED→GREEN: MockProvider + sha256-keyed fixtures (REQ-AP-003)
- [x] 3.4 ProviderSelectorService fallback + registry injection (REQ-AP-006)

## Phase 4: Context + Prompts

- [x] 4.1 Extend IrClass/IrMethod: decorator args, ctor params, FQN imports (REQ-CA-002; coord. w/ parser)
- [x] 4.2 CodeSketchBuilder: signatures only, strip comments/literals/private helpers (REQ-CA-002/003)
- [x] 4.3 Allow/deny-list: .ts/.tsx allow, `.env*` deny, warn+skip (REQ-CA-004)
- [x] 4.4 Assembler: ≤5000 budget, priority truncation, sha256 cache (REQ-CA-005/006)
- [x] 4.5 Template loader + classify-lifecycle v1 files (REQ-PM-001)
- [x] 4.6 PromptBuilder: 4 sections, `<code>` XML isolation, substitution, 6000 budget (REQ-PM-002/003/005)
- [x] 4.7 Framework configs nestjs.json/express.json + generic fallback (REQ-PM-006)

## Phase 5: Pipeline + Merge + Docs

- [x] 5.1 EnrichmentRepository: findByAnalysisId idempotency + save (REQ-EP-006)
- [x] 5.2 ThreeGatesValidator: schema retry, referential drop, confidence ≥0.7 (REQ-EP-004)
- [x] 5.3 EnrichmentService 7-stage orchestration + per-unit fallback (REQ-EP-003)
- [x] 5.4 JobProcessor (attempts/backoff/DLQ) + EventHandler ai.enabled gate (REQ-EP-001/002)
- [x] 5.5 KG merge: resolveClassType AI override + GUARD/PIPE/INTERCEPTOR/MIDDLEWARE nodes + PROTECTS/TRANSFORMS edges (REQ-EP-007; coord. w/ RFV)
- [x] 5.6 Wire AiModule into app.module.ts
- [x] 5.7 Amend RFC-009 §14: signatures-only override, XML isolation, deny-list
- [x] 5.8 Integration specs: happy path, provider-down fallback, manifest idempotency (REQ-EP-003/009)
