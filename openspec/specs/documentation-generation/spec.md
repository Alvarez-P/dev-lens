# documentation-generation Specification

## Purpose

Define the documentation generation pipeline: event-triggered and on-demand, with idempotent, cached, and progress-reported execution. Transforms Knowledge Graph data into documentation artifacts via template selection, content extraction, optional AI enrichment, and format rendering. Per RFC-011 §5.1.

## Requirements

| #   | Requirement                     | Strength |
| --- | ------------------------------- | -------- |
| R1  | Event-triggered generation      | MUST     |
| R2  | On-demand generation endpoint   | MUST     |
| R3  | Pipeline stages                 | MUST     |
| R4  | Idempotency per commit SHA      | MUST     |
| R5  | Progress reporting events       | MUST     |
| R6  | Per-analysis AI section caching | MUST     |

### Requirement: Event-Triggered Generation

The documentation generator SHALL listen for `knowledge-graph.built` and `knowledge-graph.updated` domain events. Upon receiving either event, a BullMQ job SHALL be enqueued to the `documentation-generation` queue with the repository ID and commit SHA as job data.

#### Scenario: Auto-generation after knowledge graph built

- GIVEN a repository has completed its initial knowledge graph analysis
- WHEN the `knowledge-graph.built` event is dispatched
- THEN a BullMQ job is enqueued in the `documentation-generation` queue
- AND the job data includes `repositoryId` and `commitSha`

#### Scenario: Auto-generation after knowledge graph updated

- GIVEN a repository's knowledge graph is updated after incremental analysis
- WHEN the `knowledge-graph.updated` event is dispatched
- THEN a BullMQ job is enqueued in the `documentation-generation` queue
- AND the job data includes the updated `repositoryId` and new `commitSha`

#### Scenario: Event handler can be flag-gated off

- GIVEN the documentation event handler is disabled via feature flag
- WHEN `knowledge-graph.built` is dispatched
- THEN no BullMQ job is enqueued

### Requirement: On-Demand Generation Endpoint

The system SHALL expose `POST /api/v1/repositories/:id/docs/generate` that enqueues a BullMQ job for on-demand generation. The request body MAY specify a subset of doc types to generate; if omitted, all applicable types SHALL be generated. The endpoint SHALL return the job ID for status polling.

#### Scenario: Generate all doc types on demand

- GIVEN an authenticated user with repository membership
- WHEN `POST /api/v1/repositories/:id/docs/generate` is called with an empty body
- THEN a BullMQ job is enqueued for all doc types
- AND the response includes the job ID

#### Scenario: Generate specific doc types

- GIVEN an authenticated user with repository membership
- WHEN `POST /api/v1/repositories/:id/docs/generate` is called with `{ "docTypes": ["readme", "api-reference"] }`
- THEN only the README and API Reference are generated
- AND the response includes the job ID

### Requirement: Pipeline Stages

The generation pipeline SHALL execute in this order: template selection → content extraction → optional AI enrichment → format rendering → artifact storage. Each stage SHALL be implemented as a discrete step within the BullMQ job processor. Failure at any stage SHALL propagate to the `generation.failed` event with the failing stage identified.

#### Scenario: Full pipeline executes successfully

- GIVEN a BullMQ job for a repository with an existing knowledge graph
- WHEN the job processor runs
- THEN template selection resolves applicable templates
- AND content extraction pulls data from `GraphQueryService`
- AND format rendering produces output in configured formats
- AND the artifact is stored in MinIO
- AND the `generation.completed` event is dispatched

#### Scenario: Pipeline fails at AI enrichment stage

- GIVEN a BullMQ job where the AI provider is unavailable
- WHEN AI enrichment is attempted and fails
- THEN the `generation.failed` event is dispatched with `stage: "ai-enrichment"`
- AND previously generated deterministic content is NOT stored

### Requirement: Idempotency Per Commit SHA

The generation pipeline SHALL skip generation for a given doc type if a `DocArtifact` already exists in PostgreSQL for the same `repositoryId`, `commitSha`, `docType`, and `templateVersion`. The job SHALL complete successfully with a "skipped" status rather than re-generating identical output.

#### Scenario: Skip generation when artifact exists

- GIVEN a DocArtifact exists for repo R, commit SHA `abc123`, doc type `readme`, template version `1`
- WHEN generation is triggered for the same combination
- THEN no new content is generated
- AND the job completes with status "skipped"
- AND no new MinIO object is created

#### Scenario: Regenerate with updated template version

- GIVEN a DocArtifact exists for template version `1`
- WHEN generation is triggered with template version `2` for the same commit SHA
- THEN generation proceeds normally
- AND a new DocArtifact is created with `templateVersion: "2"`

### Requirement: Progress Reporting Events

The generation pipeline SHALL emit progress events via `DomainEventDispatcher` for every generation job: `generation.started` (job begins), `generation.progress` (per stage, with `stage` name and `progress` percentage), `generation.completed` (all artifacts stored, with doc type list), `generation.failed` (with `stage` and `error` message).

#### Scenario: Progress events track pipeline stages

- GIVEN a generation job with 4 pipeline stages
- WHEN the job processor runs
- THEN `generation.started` fires first
- AND `generation.progress` fires after each stage with the stage name and a progress percentage
- AND `generation.completed` fires last with the list of generated doc types

#### Scenario: Frontend polls job status via events

- GIVEN a frontend view displaying a generation progress bar
- WHEN the user triggers generation and polls the job status endpoint
- THEN the response reflects the current `generation.progress` event data
- AND the progress bar updates for each stage

### Requirement: Per-Analysis AI Section Caching

The AI enrichment stage SHALL cache enriched sections per `(filePath, contentHash)` key. When source files contributing to a section have not changed since the last generation, the cached AI response SHALL be reused without making a new AI provider call. The cache SHALL use the existing Redis infrastructure with a TTL of 90 days.

#### Scenario: AI cache hit avoids provider call

- GIVEN a module's source files with the same content hashes as the prior generation
- AND a cached AI enrichment exists for those hashes
- WHEN the AI enrichment stage runs
- THEN the cached enrichment content is used
- AND no AI provider call is made

#### Scenario: AI cache miss triggers new call

- GIVEN a module's source files have changed (different content hashes)
- WHEN the AI enrichment stage runs
- THEN a new AI provider call is made
- AND the result is cached under the new content hash key

## References

- RFC-011 §5.1 (Pipeline), §12 (Performance)
- EPIC-009 (Documentation Engine)
