# RFC-009 — AI Orchestration

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the AI Orchestration layer — the runtime system that coordinates AI capabilities, retrieves context from the Knowledge Graph, executes Large Language Model (LLM) requests, streams responses to users, and observes every AI interaction.

AI Orchestration is the engine. It handles the _how_ of AI execution: context assembly, RAG pipeline, streaming, observability, and lifecycle management.

AI Architecture (RFC-010) defines _what_ capabilities exist and _how_ they are structured. AI Orchestration defines _how_ they run.

---

# 2. Motivation

AI in DevLens is not a chatbot. It is a structured capability that explains software using deterministic knowledge as its foundation.

Without an orchestration layer, every AI capability would implement its own:

- Context retrieval from the Knowledge Graph.
- Prompt assembly.
- Provider communication.
- Streaming logic.
- Error handling.
- Usage tracking.

This duplication increases maintenance cost, fragments observability, and makes provider migration expensive.

A centralized orchestration layer ensures:

- Consistent context assembly across all capabilities.
- Single integration point for all AI providers.
- Unified observability (latency, cost, tokens, success rate).
- Predictable error handling and retries.
- Provider independence — switch providers through configuration, not code changes.

---

# 3. Goals

The AI Orchestration layer must:

- Retrieve context from the Knowledge Graph for any AI capability.
- Assemble prompts with deterministic context and user queries.
- Route requests to the configured AI provider.
- Stream responses to the frontend (Server-Sent Events / WebSocket).
- Track every AI request: provider, latency, tokens, cost, success/failure.
- Support multiple concurrent AI requests.
- Enforce rate limits and usage quotas per user/organization.
- Cache reusable context to reduce redundant Knowledge Graph queries.
- Remain provider-agnostic — the AI Provider Interface (RFC-010) is the only integration point.

---

# 4. Non-Goals

This RFC does **not** define:

- AI capability definitions, prompt templates, or context strategies (see RFC-010).
- Provider abstraction interface (see RFC-010).
- Knowledge Graph construction (see RFC-007).
- The exact LLM models to use.
- AI security policies (these live in the Identity and Enterprise epics).

---

# 5. Architecture

## 5.1 Orchestration Pipeline

Every AI request follows the same pipeline:

```text
User Request
        │
        ▼
Capability Router
  - Identify capability from request type
  - Validate user access to capability
        │
        ▼
Context Assembler
  - Query Knowledge Graph (RFC-007)
  - Retrieve relevant nodes and relationships
  - Apply context strategy from capability definition
        │
        ▼
Prompt Builder
  - Merge context + user query + capability template
  - Apply token budget constraints
  - Truncate context if necessary
        │
        ▼
Provider Adapter
  - Route to configured AI provider (RFC-010)
  - Handle provider-specific request format
  - Stream response chunks
        │
        ▼
Response Stream
  - Forward chunks to frontend via SSE/WebSocket
  - Capture final response for observability
        │
        ▼
Observer
  - Record: capability, provider, latency, tokens, cost
  - Emit AIRequestCompleted event
```

## 5.2 Orchestrator as Singleton Service

A single `AIService` within the AI bounded context handles all requests. Capability-specific logic (what context to fetch, which prompt template to use) is injected from the capability registry defined in RFC-010, not hardcoded in the orchestrator.

---

# 6. Context Assembly

The Context Assembler is the most critical component. It determines what the LLM "sees" before generating a response.

## 6.1 Context Sources

Context is assembled from the Knowledge Graph, not from raw source code:

1. **Node detail**: the selected node (e.g., a specific Service) and its properties.
2. **Direct relationships**: nodes directly connected to the target.
3. **Transitive relationships**: dependencies and dependents up to a configurable depth.
4. **Domain context**: the bounded context and aggregate that own the target.
5. **API surface**: endpoints exposed by the target.
6. **Event surface**: events published and consumed.
7. **Repository metadata**: language, framework, project structure.

## 6.2 Context Strategy

Each AI capability (RFC-010) defines a **context strategy** that specifies:

| Parameter                 | Description                                        | Example                  |
| ------------------------- | -------------------------------------------------- | ------------------------ |
| `target_node`             | The primary node to explain                        | `Service:PaymentService` |
| `relationship_depth`      | How many hops to traverse                          | 2                        |
| `include_dependents`      | Whether to include nodes that depend on the target | true                     |
| `include_dependencies`    | Whether to include nodes the target depends on     | true                     |
| `include_api_surface`     | Whether to include endpoints                       | true                     |
| `include_event_surface`   | Whether to include events                          | false                    |
| `include_source_snippets` | Whether to include source code excerpts            | false (never for MVP)    |
| `max_context_tokens`      | Token budget for assembled context                 | 4000                     |

## 6.3 Context Truncation

If the assembled context exceeds the token budget:

1. Prioritize direct relationships over transitive ones.
2. Truncate relationship lists (show first N, indicate more exist).
3. Summarize metadata rather than including full properties.
4. Never hallucinate missing context — the LLM is informed when context was truncated.

---

# 7. Prompt Assembly

## 7.1 Prompt Structure

Every prompt follows a consistent structure:

```
[System Instruction]
You are DevLens AI. You explain software systems using structured knowledge.
Always reference specific modules, services, and relationships.
Never invent information not present in the provided context.
If the context is insufficient, state what is missing.

[Knowledge Graph Context]
{assembled context from Knowledge Graph}

[User Query]
{user's question or requested capability}

[Instructions]
{capability-specific instructions from RFC-010}
```

## 7.2 Token Budget Enforcement

- System instruction: ~200 tokens (fixed).
- Knowledge Graph context: up to `max_context_tokens`.
- User query: as provided, truncated if excessive.
- Capability instructions: ~100 tokens (fixed).
- **Total target**: ≤ 6000 tokens for the combined prompt.

The Prompt Builder validates the total token count before sending to the provider. If the budget is exceeded, context truncation is applied.

---

# 8. Streaming

All AI responses are streamed to the frontend to reduce perceived latency.

## 8.1 Protocol

- **Primary**: Server-Sent Events (SSE) for unidirectional streaming.
- **Fallback**: WebSocket for bidirectional communication (required for conversation capabilities).
- **Chunk format**: each chunk is a JSON object with `{ type: "token" | "done" | "error", content: string }`.

## 8.2 Streaming Flow

1. Frontend opens an SSE connection with the AI request ID.
2. Orchestrator begins streaming chunks as they arrive from the provider.
3. Frontend renders tokens progressively in the AI panel.
4. Final chunk includes usage metadata (tokens, cost, latency).
5. Connection closes.

## 8.3 Cancellation

Users can cancel in-flight AI requests:

- Frontend closes the SSE/WebSocket connection.
- Orchestrator aborts the provider request.
- Partial tokens consumed before cancellation are still recorded for observability.

---

# 9. Observability

Every AI interaction is measured. The AI Observer records:

## 9.1 Per-Request Metrics

| Metric               | Description                                 |
| -------------------- | ------------------------------------------- |
| `request_id`         | Unique request identifier                   |
| `capability`         | Which AI capability was invoked             |
| `provider`           | Which AI provider handled the request       |
| `model`              | Specific model version                      |
| `latency_ms`         | Total end-to-end latency                    |
| `ttft_ms`            | Time to first token                         |
| `prompt_tokens`      | Tokens in the assembled prompt              |
| `completion_tokens`  | Tokens in the generated response            |
| `total_tokens`       | Sum of prompt + completion                  |
| `estimated_cost_usd` | Cost based on provider pricing              |
| `success`            | Whether the request completed without error |
| `error_type`         | Error classification if failed              |
| `user_id`            | Requesting user                             |
| `organization_id`    | Requesting organization                     |
| `truncated`          | Whether context was truncated due to budget |
| `cache_hit`          | Whether context was served from cache       |

## 9.2 Aggregated Metrics

- Daily/weekly/monthly: total requests, tokens, cost per organization.
- Per-capability: success rate, average latency.
- Per-provider: usage distribution, cost comparison.

## 9.3 Events

| Event                | When                                    |
| -------------------- | --------------------------------------- |
| `AIRequestStarted`   | Request enters the pipeline             |
| `AIRequestCompleted` | Request succeeds                        |
| `AIRequestFailed`    | Request fails (after retries exhausted) |
| `AIRequestCancelled` | User cancels in-flight request          |

---

# 10. Caching

Repeated AI requests for the same context should not re-query the Knowledge Graph.

## 10.1 Context Cache

- Key: `context:{capability}:{node_id}:{depth}`
- TTL: 5 minutes (configurable).
- Stored in Redis.
- Invalidated when the Knowledge Graph for the relevant repository is updated.

## 10.2 What Is Cached

- Assembled Knowledge Graph context (the structured data, not the final prompt).
- Prompt templates are not cached (they may change with capability updates).
- LLM responses are not cached (each response should be generated fresh for correctness).

---

# 11. Rate Limiting & Quotas

## 11.1 Rate Limiting

Per-user rate limits prevent abuse:

- **Free tier**: 20 AI requests per hour.
- **Professional tier**: 200 AI requests per hour.
- **Enterprise tier**: configurable per organization.

Limits are enforced by the orchestrator before context assembly (to avoid wasting Knowledge Graph queries on blocked requests).

## 11.2 Usage Quotas

Per-organization monthly quotas on:

- Total AI requests.
- Total tokens consumed.
- Total estimated cost.

Quotas are checked before each request. Organizations approaching their quota receive warnings.

---

# 12. Error Handling

## 12.1 Provider Errors

| Error                      | Action                                       |
| -------------------------- | -------------------------------------------- |
| Timeout (30s)              | Retry once, then fail                        |
| Rate limited (429)         | Exponential backoff, max 3 retries           |
| Authentication error (401) | Fail immediately, alert operations           |
| Model unavailable (503)    | Fail over to fallback provider if configured |
| Content filter (400)       | Return sanitized error to user               |

## 12.2 Context Errors

| Error                                   | Action                                                |
| --------------------------------------- | ----------------------------------------------------- |
| Knowledge Graph unavailable             | Return error: "Analysis data temporarily unavailable" |
| Node not found                          | Return error: "Component not found in analysis"       |
| Context too large even after truncation | Reduce depth and retry                                |

## 12.3 User-Facing Errors

Errors returned to users are:

- Actionable (explain what went wrong).
- Non-technical (no stack traces).
- Consistent across all capabilities.
- Localized (when i18n is implemented).

---

# 13. Performance Targets

| Metric                             | Target      |
| ---------------------------------- | ----------- |
| Context assembly                   | < 200ms     |
| Prompt building                    | < 50ms      |
| Time to first token (TTFT)         | < 2 seconds |
| Streaming latency (chunk interval) | < 100ms     |
| Cache hit context assembly         | < 10ms      |
| Concurrent requests (per instance) | 50          |

---

# 14. Security

- AI requests are authenticated and authorized through the Identity module.
- AI capabilities are gated by user tier (Free vs. Professional vs. Enterprise).
- Knowledge Graph context is scoped to the user's accessible repositories.
- No raw source code is sent to AI providers in the MVP.
- Prompt injection is mitigated by strict prompt structure and context isolation.
- AI provider API keys are stored in a secrets manager, never in code or environment variables.

### 14.1 Amendment — Signature-Level Code Sketches (ai-enrichment)

The **"no raw source code"** rule above is explicitly overridden by the
`ai-enrichment` pipeline (change 2026-08-06) for a strictly limited, hardened
subset of source-derived data:

- **Signatures only**: the LLM receives `CodeSketch` objects built from the
  IR — class/method/parameter signatures, decorators, and resolved imports.
  Method bodies, comments, string literals, and private helpers are never
  present (they never enter the IR and therefore cannot be serialized).
- **XML isolation**: every sketch is wrapped in `<code sourceFile="…">` tags,
  and the system prompt instructs the model that content between those tags is
  untrusted data whose instructions must be ignored (injection hardening).
- **Deny-list**: `.env*` files and files under ignored directories
  (`node_modules`, `dist`, `.git`, …) are excluded before sketching, so
  secrets and vendored code never reach a provider.
- **Graceful degradation**: when the pipeline is disabled (`ai.enabled=false`)
  or a provider fails, no source-derived data leaves the system at all and the
  deterministic analysis pipeline is unaffected.
- **No secrets in transit**: sketches carry no credentials; API keys live only
  in the secrets manager referenced above.

---

# 15. Future Considerations

- **Multi-turn conversations**: maintain conversation context across requests.
- **Custom AI Capabilities**: user-defined capabilities with custom context strategies (requires RFC-010 extension).
- **BYOAI (Bring Your Own AI)**: organizations provide their own API keys, routing through the same orchestration layer.
- **A/B testing**: compare responses from different providers or models.
- **Response quality scoring**: user feedback loop to evaluate AI response quality.
- **Semantic caching**: cache LLM responses for identical queries (with TTL and invalidation).

---

# 16. References

- RFC-001 — Architecture Principles (Deterministic Before Intelligent)
- RFC-007 — Knowledge Extraction Platform
- RFC-010 — AI Architecture
- EPIC-008 — AI Orchestration
- PRODUCT_CONTEXT.md — Section 13 (AI Philosophy)
