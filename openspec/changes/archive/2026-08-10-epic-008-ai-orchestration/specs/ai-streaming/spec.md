# ai-streaming Specification

> **Change**: EPIC-008 | **Type**: New | **Dependencies**: ai-provider-abstraction (streamComplete), ai-prompt-management (assembled prompt)

## Purpose

Define the SSE streaming transport, chunk contract, cancellation flow, error handling, and frontend SSE client contract. Per RFC-009 §8.

## Requirements

| #   | Requirement                            | Strength |
| --- | -------------------------------------- | -------- |
| R1  | SSE endpoint contract                  | MUST     |
| R2  | Chunk format                           | MUST     |
| R3  | Streaming flow (open → chunks → close) | MUST     |
| R4  | Cancellation via connection close      | MUST     |
| R5  | Error handling with sanitized messages | MUST     |
| R6  | Frontend SSE client                    | MUST     |

### Requirement: SSE Endpoint Contract

The system MUST expose an SSE endpoint for streaming AI responses using NestJS `@Sse()` decorator. The endpoint SHALL accept a POST request with a body containing: `capability` (string), `target_node_fqn` (string), `query` (string, optional). The response Content-Type MUST be `text/event-stream`. No global response-transform interceptor SHALL buffer SSE streams.

#### Scenario: SSE endpoint streams chunks to client

- GIVEN a POST to `/api/v1/ai/stream` with `{ capability: "explain-module", target_node_fqn: "src/orders/OrderService" }`
- WHEN the orchestrator begins streaming
- THEN the response is `text/event-stream`
- AND chunks arrive progressively without waiting for completion

### Requirement: Chunk Format

Each SSE event MUST be a JSON object with `{ type, content }`. Types: `"token"` (partial response text), `"done"` (completion with usage metadata: `tokens`, `cost`, `model`), `"error"` (failure with `code` and `message`). The `done` event SHALL be the final event before connection close.

#### Scenario: Normal streaming sequence

- GIVEN a successful AI request
- WHEN streaming begins
- THEN a sequence of `{ type: "token", content: "The" }`, `{ type: "token", content: " OrderService" }`, ... arrives
- AND a final `{ type: "done", content: { tokens: 450, cost: 0.001 } }` event completes the stream

### Requirement: Cancellation via Connection Close

When the client closes the SSE connection (AbortController or EventSource.close()), the orchestrator SHALL abort the in-flight provider request. A `AIRequestCancelled` event SHALL be emitted immediately. Partial tokens consumed before cancellation SHALL be recorded in observability.

#### Scenario: User cancels mid-stream

- GIVEN an AI request streaming tokens
- WHEN the user closes the connection (e.g., clicks Cancel)
- THEN the provider request is aborted
- AND `AIRequestCancelled` is published
- AND partial token count is logged

### Requirement: Error Handling

Provider errors (timeout, rate limit 429, auth 401, model unavailable 503) SHALL be emitted as `{ type: "error", content: { code, message } }`. Error messages sent to the frontend MUST be sanitized — no stack traces, no internal provider details, no API keys. The `error` event SHALL be the final event.

#### Scenario: OpenAI rate limit during streaming

- GIVEN OpenAI returns a 429 during streaming
- WHEN the error is caught
- THEN the SSE emits `{ type: "error", content: { code: "RATE_LIMITED", message: "AI service temporarily busy. Try again in a moment." } }`
- AND the connection closes

### Requirement: Frontend SSE Client

The frontend MUST implement an SSE client that: (1) sends POST with fetch + ReadableStream, (2) disables the existing 30s default timeout (streams are long-lived), (3) supports cancellation via AbortController, (4) parses SSE chunks and renders tokens progressively in the AI panel. The `combineAbortSignals` utility from `api-client.ts` SHALL be reused for cancellation.

#### Scenario: Frontend renders progressive tokens

- GIVEN a streaming AI response
- WHEN the frontend receives token chunks
- THEN each token is appended to the visible AI panel text immediately
- AND a Cancel button is visible during streaming
- AND clicking Cancel aborts the fetch and clears the stream

> **Cross-reference**: ai-provider-abstraction defines `streamComplete`. ai-observability captures `AIRequestCancelled`. Deferred: WebSocket transport (conversation).
