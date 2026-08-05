# knowledge-graph-pipeline Specification

> **Archived from**: `epic-006-knowledge-graph` (2026-08-04)

## Purpose

Define the event-driven pipeline that orchestrates graph construction: subscribing to `analysis.completed`, enqueuing a BullMQ job, executing the three-stage build (load → construct → persist), publishing domain events, and handling failures with retries. Per RFC-007 §5 and §12.

## Requirements

### Requirement: Event Subscription

The KnowledgeGraphModule SHALL register a handler for `analysis.completed` events on module initialization. The handler SHALL extract `snapshotId`, `repositoryId`, and `analysisId` from the event payload and enqueue a job on the `knowledge-graph` BullMQ queue.

> **Note (implementation)**: The enqueued job payload carries `analysisId` only — the service derives everything else from it. Idempotency is enforced at the service level (verified W4/W5).

#### Scenario: analysis.completed triggers graph job

- GIVEN a registered event handler
- WHEN an `AnalysisCompletedEvent` is dispatched with `analysisId = 'X'`
- THEN a BullMQ job is enqueued on the `knowledge-graph` queue containing `analysisId = 'X'`

### Requirement: Idempotency

The pipeline SHALL skip processing if a GraphSnapshot already exists for the given `analysisId`. This prevents duplicate graph builds on event redelivery.

#### Scenario: Redelivered event is skipped

- GIVEN a GraphSnapshot with `status = 'built'` for `analysisId = 'X'`
- WHEN another `analysis.completed` event arrives with the same analysisId
- THEN the handler does not enqueue a new job
- AND no duplicate graph is built

#### Scenario: Failed build is retried

- GIVEN a GraphSnapshot with `status = 'failed'` for `analysisId = 'X'`
- WHEN a redelivered event arrives with the same analysisId
- THEN the handler MAY enqueue a retry job

### Requirement: Pipeline Stages

The `KnowledgeGraphService.build()` method SHALL execute these stages in order:

1. Load the Analysis (IR) via `AnalysisRepository.findById(analysisId)`
2. Load the Snapshot (commit SHA) via `SnapshotRepository.findById(snapshotId)`
3. Stage 1: `SemanticModelBuilder.build(ir)` → SemanticModel
4. Stage 2: `KnowledgeGraphBuilder.build(semanticModel, previousVersion)` → nodes + edges
5. Validate edge integrity
6. Persist nodes, edges, and snapshot in a single transaction
7. Publish `KnowledgeGraphBuilt` (first version) or `KnowledgeGraphUpdated` (subsequent)

#### Scenario: Successful three-stage build

- GIVEN a valid IR and no prior graph version for the repository
- WHEN `KnowledgeGraphService.build()` executes
- THEN all 7 steps complete without errors
- AND a `KnowledgeGraphBuilt` event is published

### Requirement: Error Handling and Retries

BullMQ jobs on the `knowledge-graph` queue SHALL use 3 attempts with exponential backoff. After exhausting retries, the job SHALL be routed to a dead letter queue (DLQ). On failure, the snapshot status SHALL be set to `failed` and the previous valid graph state SHALL be preserved.

#### Scenario: Transient failure retries succeed

- GIVEN the first attempt fails due to a database connection error
- WHEN BullMQ retries with backoff
- THEN the second or third attempt succeeds
- AND the graph is persisted with status `built`

#### Scenario: All retries exhausted routes to DLQ

- GIVEN all 3 attempts fail with a persistent error
- WHEN the retry limit is reached
- THEN the job is moved to the DLQ
- AND the snapshot status is `failed`

### Requirement: Upstream Dependency

The `AnalysisRepository` SHALL be exported from `AnalysisModule` so the Knowledge Graph module can load IR via `findById(analysisId)`. The `SnapshotRepository` (already exported) SHALL provide the commit SHA for versioning.

#### Scenario: KnowledgeGraphService loads IR from AnalysisRepository

- GIVEN an analysis persisted with `id = 'X'` containing an IR
- WHEN `AnalysisRepository.findById('X')` is called
- THEN the full Analysis aggregate with its IR is returned
- AND the Knowledge Graph module has no direct dependency on IR internals

### Requirement: Event Publishing

After a successful build, the pipeline SHALL publish `KnowledgeGraphBuilt` (first graph version for a repository) or `KnowledgeGraphUpdated` (incremental update). Both events SHALL include `repositoryId`, `snapshotId`, and `analysisId`.

#### Scenario: First build publishes Built event

- GIVEN no prior graph version exists for the repository
- WHEN a successful build completes
- THEN a `KnowledgeGraphBuilt` event is published via the DomainEventDispatcher

#### Scenario: Subsequent build publishes Updated event

- GIVEN a graph version already exists for the repository
- WHEN a successful incremental build completes
- THEN a `KnowledgeGraphUpdated` event is published

## References

- RFC-007 §5 (Pipeline Architecture), §11 (Domain Events), §12 (Error Handling)
- EPIC-006 §2.2 (Graph Engine), Exploration §4 (Trigger Mechanism)
