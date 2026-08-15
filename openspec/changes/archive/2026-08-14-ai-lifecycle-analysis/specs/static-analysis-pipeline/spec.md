# Delta for Static Analysis Pipeline

## ADDED Requirements

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
