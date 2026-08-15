# Static Analysis Pipeline Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)
> **Updated by**: `ai-lifecycle-analysis` (2026-08-14) — deterministic pipeline designated structural skeleton; AI enrichment runs as additive stage on `analysis.completed`, never inside `StaticAnalysisService`

## Purpose

`StaticAnalysisService` orchestrates the full analysis pipeline: snapshot → detect → parse → build IR → validate → persist → publish event. Per RFC-006 §15, the pipeline is triggered by `repository.synchronized` events and publishes `analysis.*` domain events for downstream consumers.

## Requirements

### Requirement: Pipeline Orchestration

`StaticAnalysisService` SHALL execute the pipeline stages in strict sequence. If any stage fails, the pipeline SHALL abort, emit `analysis.failed`, and log the error with correlation ID. Pipeline execution MUST be idempotent by `snapshotId` — re-running the same snapshot SHALL skip if a valid IR already exists.

#### Scenario: Happy path — full pipeline

- GIVEN a `repository.synchronized` event with a valid `snapshotId`
- WHEN the pipeline executes
- THEN language detection runs, parsers produce ASTs, the IR builder generates valid IR, validation passes, IR is persisted, and `analysis.completed` is emitted

#### Scenario: Parse failure aborts pipeline

- GIVEN a snapshot where a `.ts` file has syntax errors preventing parse
- WHEN the pipeline reaches the parse stage
- THEN an `analysis.failed` event is emitted with the error diagnostics
- AND no IR is persisted

#### Scenario: Validation failure blocks publication

- GIVEN parse results that produce an IR with a referential integrity violation
- WHEN the pipeline reaches the validate stage
- THEN the validator rejects the IR
- AND `analysis.failed` is emitted
- AND no IR is persisted

### Requirement: DomainEventDispatcher Extension

The `DomainEventDispatcher` interface SHALL be extended with a `registerHandler(eventType: string, handler: DomainEventHandler): void` method. `InMemoryDomainEventDispatcher` MUST implement this method.

#### Scenario: Handler registered and invoked

- GIVEN a handler registered for `repository.synchronized`
- WHEN a `repository.synchronized` event is dispatched
- THEN the handler is invoked with the event
- AND the handler enqueues an analysis job

#### Scenario: Multiple handlers for same event type

- GIVEN two handlers registered for `analysis.completed`
- WHEN `analysis.completed` is dispatched
- THEN both handlers are invoked (order not guaranteed)

### Requirement: BullMQ Integration

The system SHALL create a BullMQ `analysis` queue. A job processor SHALL accept `snapshotId` and delegate to `StaticAnalysisService`. Failed jobs SHALL be retried with exponential backoff (max 3 attempts). After max retries, the job SHALL be moved to the dead-letter queue.

#### Scenario: Job enqueued by event handler

- GIVEN a `repository.synchronized` event
- WHEN the registered handler processes it
- THEN a BullMQ job is added to the `analysis` queue with `data.snapshotId`
- AND `analysis.started` is emitted when the job begins processing

#### Scenario: Job retry on transient failure

- GIVEN an analysis job that fails due to a transient database error
- WHEN the job processor catches the error
- THEN BullMQ retries the job up to 3 times
- AND `analysis.failed` is emitted only after the final retry

### Requirement: IR Persistence

Valid IR SHALL be persisted as JSONB keyed by `snapshotId`. The persistence model MUST store the IR as an immutable document — no partial updates. The `SnapshotRepository` SHALL be exported from `RepositoriesModule` via its `exports` array.

#### Scenario: IR persisted after validation

- GIVEN a validated IR
- WHEN the pipeline reaches the persist stage
- THEN the IR is stored as a JSONB document associated with the `snapshotId`
- AND `analysis.completed` is emitted with the IR's identifier

### Requirement: Analysis Events

The pipeline SHALL emit three event types using RFC-006 §15 naming conventions (`analysis.*`):

| Event                | Emitted When              |
| -------------------- | ------------------------- |
| `analysis.started`   | Job begins processing     |
| `analysis.completed` | IR persisted successfully |
| `analysis.failed`    | Any stage fails           |

Each event SHALL include: `snapshotId`, `repositoryId`, `workspaceId`, `correlationId`, and `timestamp`.

#### Scenario: Complete event sequence

- GIVEN a successful pipeline run
- WHEN the pipeline executes
- THEN `analysis.started` is emitted first, followed by `analysis.completed`
- AND both events share the same `correlationId`

### Requirement: Deterministic Pipeline as Structural Skeleton

The deterministic analysis pipeline (`StaticAnalysisService`) SHALL remain the structural skeleton: language detection, parsing, IR build, validation, and persistence. AI enrichment SHALL run as an additive, separate stage triggered by `analysis.completed` — never inside `StaticAnalysisService`. When `ai.enabled=false`, pipeline behavior SHALL be unchanged.

#### Scenario: AI enrichment is downstream of analysis

- GIVEN `analysis.completed` is emitted with a valid IR
- WHEN the `ai-enrichment` stage is registered as a handler for `analysis.completed`
- THEN enrichment runs after analysis completes
- AND the deterministic IR is produced independently of AI

#### Scenario: AI disabled leaves pipeline behavior unchanged

- GIVEN `ai.enabled=false`
- WHEN a `repository.synchronized` event triggers the pipeline
- THEN the pipeline stages execute exactly as before
- AND no AI stage runs

## References

- RFC-006 §5 (Pipeline), §15 (Integration Events), §17 (Observability)
- RFC-004 §5–8 (Event Philosophy, Contracts)
- EPIC-005 §2.8 (Events), §3.1 (Analysis Pipeline)
