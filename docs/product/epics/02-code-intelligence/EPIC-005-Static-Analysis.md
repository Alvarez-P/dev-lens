```markdown
# EPIC-005 — Static Analysis

**Status:** Not Started

---

# Overview

The Static Analysis Epic is the foundation of DevLens' intelligence layer.

Its purpose is to transform raw source code into structured, deterministic metadata that accurately represents the architecture of a software system.

This Epic intentionally performs **no AI inference**. Every extracted piece of information must be obtained through deterministic analysis of the source code.

The resulting metadata will become the input for the Knowledge Graph, Documentation Engine, Search Engine, Architecture Metrics, and AI Orchestration.

---

# Objectives

- Parse supported source code.
- Build a language-independent analysis pipeline.
- Extract architectural metadata.
- Detect relationships between software components.
- Generate a normalized intermediate representation (IR).
- Support incremental analysis.
- Produce deterministic outputs.
- Emit analysis events for downstream consumers.

---

# Scope

## Included

### Project Discovery

- Detect project type.
- Detect package manager.
- Detect framework.
- Detect language version.
- Detect monorepos.
- Detect workspace configuration.

### Source Code Parsing

- AST generation.
- Symbol resolution.
- Type resolution.
- Import resolution.
- Decorator extraction.
- Metadata extraction.

### Architecture Discovery

Automatically identify:

- Modules
- Controllers
- Services
- Providers
- Repositories
- Entities
- Value Objects
- Aggregates
- DTOs
- Interfaces
- Enums
- Events
- Commands
- Queries
- Guards
- Interceptors
- Pipes
- Middleware

### API Discovery

Automatically identify:

- REST endpoints
- HTTP methods
- Routes
- Parameters
- Request DTOs
- Response DTOs
- Authentication decorators
- Validation decorators

### Dependency Analysis

Identify:

- Imports
- Internal dependencies
- External dependencies
- Circular dependencies
- Module boundaries
- Layer violations

### Domain Analysis

Extract:

- Bounded contexts
- Domain services
- Aggregates
- Entities
- Value Objects
- Domain Events
- Repository contracts

### Metadata Generation

Produce a normalized Intermediate Representation (IR) that is independent of programming language or framework.

The IR becomes the contract between Static Analysis and every downstream module.

### Incremental Analysis

- Detect changed files.
- Analyze only affected files.
- Rebuild affected relationships.
- Preserve previous analysis whenever possible.

### Events

Publish domain events such as:

- RepositoryIndexed
- AnalysisStarted
- AnalysisCompleted
- AnalysisFailed
- MetadataUpdated

Events should remain transport agnostic.

---

# Out of Scope

The following capabilities are intentionally excluded:

- Knowledge Graph persistence.
- AI processing.
- LLM prompts.
- Documentation generation.
- Semantic search.
- Visualization.
- Architecture scoring.
- Code generation.
- Repository synchronization.

This Epic extracts knowledge only.

It does not consume it.

---

# Dependencies

- EPIC-001 — Foundation
- EPIC-002 — Core Platform
- EPIC-003 — Identity
- EPIC-004 — Repository Management

---

# Required Documents

The following documents must be reviewed before implementation:

- `docs/product/PRODUCT_CONTEXT.md`
- `docs/architecture/RFC-002-System-Architecture.md`
- `docs/architecture/RFC-003-Domain-Driven-Design.md`
- `docs/architecture/RFC-007-AI-Orchestration.md`
- Relevant ADRs

---

# Deliverables

## Analysis Pipeline

- Parser abstraction.
- Language adapters.
- AST generation.
- Metadata extraction.
- Intermediate Representation (IR).
- Incremental analysis pipeline.

## Language Support

Initial support:

- TypeScript
- JavaScript

Architecture prepared for future support:

- Go
- Python
- Java
- C#
- PHP

No architectural changes should be required to support additional languages.

## Metadata Model

The analysis engine must extract:

- Projects
- Packages
- Modules
- Files
- Classes
- Interfaces
- Functions
- Methods
- Properties
- Decorators
- Dependencies
- API Endpoints
- Events
- Domain Objects

## Analysis Engine

- Full repository analysis.
- Incremental analysis.
- Parallel processing where appropriate.
- Error isolation.
- Progress reporting.

## Event Integration

The analysis pipeline should emit domain events that notify downstream modules when new metadata is available.

The Static Analysis Engine must not know who consumes these events.

---

# Acceptance Criteria

This Epic is considered complete when:

- A supported repository can be analyzed successfully.
- Metadata is extracted deterministically.
- Incremental analysis processes only modified files.
- Circular dependencies are detected.
- API endpoints are discovered automatically.
- Architectural components are identified correctly.
- The Intermediate Representation (IR) is generated successfully.
- Domain events are emitted after analysis completes.
- The output can be consumed by the Knowledge Graph without additional parsing.

---

# Success Criteria

After completing this Epic, DevLens should possess a complete, deterministic understanding of the structure of a software repository.

The platform should no longer depend on raw source code for downstream capabilities.

Instead, every subsequent subsystem—including the Knowledge Graph, Visualization Engine, Documentation Engine, Search Engine, Metrics Engine, and AI Orchestration—should consume the Intermediate Representation produced by the Static Analysis Engine.

This Epic represents the transition from **source code** to **structured software knowledge**, forming the technical foundation upon which the rest of DevLens is built.
```
