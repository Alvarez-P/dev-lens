# PRODUCT_CONTEXT.md

> **DevLens – Product Context**
>
> **Version:** 1.0 (Draft)
>
> **Purpose**
>
> This document is the primary source of context for both developers and AI agents working on DevLens.
>
> Before implementing any feature, architectural decision, or code change, this document **must be read first**.
>
> Its purpose is to explain **what DevLens is**, **why it exists**, **who it serves**, and **which principles must guide every decision**.
>
> Technical implementation details belong in the RFCs. This document intentionally focuses on product direction and immutable design principles.

---

# 1. Executive Summary

## What is DevLens?

DevLens is a **Software Intelligence Platform** that transforms software repositories into an interactive, continuously updated representation of a software system.

Instead of showing developers another file explorer or another AI chat interface, DevLens builds a structured understanding of the application by combining:

* Static code analysis
* Domain modeling
* Knowledge Graph generation
* AI orchestration
* Interactive architecture visualization

The result is a living Digital Twin of the software that enables developers to understand, navigate and evolve complex systems significantly faster.

---

## Mission

Reduce the time required to understand an unfamiliar codebase from days to minutes.

---

## Vision

Every software project should be self-explanatory.

Documentation should never become outdated.

Architecture should always reflect reality.

Artificial Intelligence should explain systems—not guess how they work.

---

## Product Positioning

DevLens is **not** an AI coding assistant.

It is **not** an IDE.

It is **not** a documentation tool.

It is a **Software Intelligence Platform**.

Its primary value is transforming source code into structured knowledge that can be explored visually, queried intelligently and exported automatically.

---

## Core Value Proposition

Developers should never have to answer questions like:

* Where does this request start?
* Which services depend on this module?
* What breaks if I modify this class?
* Which APIs are undocumented?
* How is authentication implemented?
* Which domain owns this feature?
* Where should I implement a new requirement?

DevLens should answer these questions in seconds through visual exploration and contextual AI.

---

## Product Identity

If GitHub is where software is stored,

and IDEs are where software is written,

DevLens is where software is understood.

---

# 2. Product Vision

## Long-Term Vision

DevLens aims to become the standard platform for understanding software systems.

Every repository connected to DevLens should evolve into a living representation of the application, continuously synchronized with the source code.

The platform should help developers answer architectural and business questions without manually reading hundreds of files.

The emphasis is understanding, not generation.

---

## Philosophy

Software projects become harder to maintain because knowledge is scattered.

Part of it lives in:

* Source code
* Documentation
* Team members
* Pull requests
* Architecture diagrams
* Wikis
* Tickets
* Developer experience

Most of this knowledge is either duplicated or eventually becomes outdated.

DevLens exists to centralize that knowledge into a single, continuously generated source of truth.

---

## What Success Looks Like

A new developer joins a company.

Instead of spending weeks learning the project by reading code, documentation and asking teammates, they open DevLens.

Within minutes they can:

* Understand the architecture.
* Discover module relationships.
* Visualize dependencies.
* Explore APIs.
* Navigate the domain.
* Ask contextual questions.
* Generate technical documentation.
* Identify risks before making changes.

The platform should dramatically reduce onboarding time while increasing confidence during development.

---

## Design Philosophy

Every feature should answer one of these questions:

* Does it help someone understand the software?
* Does it reduce cognitive load?
* Does it make architectural decisions more visible?
* Does it increase confidence before changing code?

If the answer is **no**, the feature probably does not belong in DevLens.

---

# 3. Problem Statement

## The Current Reality

Modern software systems are increasingly complex.

Projects commonly include:

* Hundreds of files
* Multiple architectural layers
* Distributed systems
* Event-driven communication
* External services
* Legacy code
* Sparse documentation

Although modern IDEs make editing code easier, they provide very little understanding of the system as a whole.

Developers are forced to reconstruct the architecture mentally.

---

## Existing Documentation Fails

Traditional documentation suffers from several problems:

* It is written manually.
* It quickly becomes outdated.
* It is incomplete.
* It rarely reflects the current architecture.
* It requires continuous maintenance.

As projects evolve, documentation quality tends to decrease.

Eventually developers stop trusting it.

---

## Existing AI Tools Have Limitations

Most AI developer tools operate directly on raw source code.

This creates several problems:

* Limited project-wide understanding.
* Context window constraints.
* Hallucinations.
* Inconsistent explanations.
* High inference costs.
* Repeated analysis of the same code.

The AI repeatedly reconstructs knowledge that should already exist.

---

## Architecture Is Invisible

Most software architecture only exists inside developers' minds.

Relationships between modules are rarely explicit.

Dependencies are difficult to visualize.

Impact analysis requires manually exploring the codebase.

This increases the cost and risk of every change.

---

## The Cost

These problems produce measurable consequences:

* Slow onboarding.
* Fear of refactoring.
* Technical debt.
* Poor documentation.
* Duplicate work.
* Increased maintenance costs.
* Reduced developer confidence.

The larger the project becomes, the more expensive these problems are.

---

# 4. Target Users

DevLens is designed for professionals who need to understand software systems.

It is **not** intended for beginners learning to program.

---

## Senior Software Engineers

### Goals

* Understand unfamiliar code quickly.
* Reduce debugging time.
* Explore dependencies.
* Validate architectural decisions.
* Improve development speed.

### Typical Questions

* Where is this feature implemented?
* Which modules consume this service?
* What breaks if I modify this interface?

---

## Technical Leads

### Goals

* Review architecture.
* Evaluate technical debt.
* Guide development teams.
* Improve code quality.
* Accelerate onboarding.

### Typical Questions

* Which modules are tightly coupled?
* Where should this feature belong?
* Which services violate architectural boundaries?

---

## Software Architects

### Goals

* Analyze large systems.
* Detect architectural erosion.
* Validate domain boundaries.
* Review dependencies.
* Understand communication flows.

### Typical Questions

* Does the implementation match the intended architecture?
* Which bounded contexts are leaking responsibilities?
* Which dependencies should be removed?

---

## Engineering Managers

### Goals

* Reduce onboarding time.
* Improve documentation quality.
* Increase development velocity.
* Reduce maintenance risk.

### Typical Questions

* How difficult is this project to maintain?
* Which areas have the highest complexity?
* Where should technical debt be addressed first?

---

## Consultants

Consultants frequently work with unfamiliar codebases.

Their success depends on understanding systems quickly.

DevLens helps them produce architectural insights in hours instead of days.

---

## Enterprise Teams

Large organizations often maintain software for years.

Knowledge becomes fragmented as teams change.

DevLens preserves architectural knowledge independently of individual developers.

---

# 5. Product Principles

The following principles define DevLens.

Every new feature should reinforce them.

---

## 1. Knowledge Is the Product

The Knowledge Graph is the primary asset.

Artificial Intelligence is simply one interface for consuming that knowledge.

---

## 2. Visual First

People understand complex systems faster through visual representations than through text.

Whenever possible, DevLens should present information visually before presenting raw data.

Interactive diagrams are first-class citizens.

---

## 3. AI Explains, It Does Not Guess

The AI should answer questions using structured knowledge extracted from the repository.

It should never rely on assumptions when deterministic information already exists.

---

## 4. Documentation Is Generated

Documentation should never require manual maintenance.

Every artifact generated by DevLens must be reproducible from the current state of the repository.

---

## 5. Progressive Analysis

Users should receive value immediately.

Repository analysis should enrich the project incrementally rather than blocking until every task completes.

---

## 6. Vendor Independence

External providers are implementation details.

No core capability should depend on a specific cloud provider, AI vendor or messaging platform.

Replacing infrastructure should not require redesigning the domain.

---

## 7. Performance Is a Feature

Fast feedback improves developer productivity.

Every interaction should feel immediate.

Heavy computation belongs in background workers.

The frontend should remain lightweight.

---

## 8. Simplicity Over Cleverness

Readable software outlives clever software.

The architecture should favor explicitness, consistency and maintainability.

---

## 9. Architecture Is a Product Feature

Architecture visualization is not a secondary feature.

It is one of DevLens' primary differentiators.

Users should be able to understand the structure of an application without reading its source code.

---

## 10. Trust Is Essential

Developers will only rely on DevLens if its outputs are consistently accurate.

Whenever deterministic information exists, it must take precedence over probabilistic AI responses.

Confidence is more valuable than creativity.

---

# 6. Current Scope (MVP)

The first public version focuses on solving one problem exceptionally well:

**Understanding a single software repository.**

The MVP includes:

* Repository connection.
* Incremental repository indexing.
* Static code analysis.
* Knowledge Graph generation.
* Interactive architecture visualization.
* Dependency exploration.
* API discovery.
* Automatic documentation generation.
* AI-powered contextual explanations.
* Documentation export.
* Architecture metrics.
* Search.
* User authentication.
* Organizations and workspaces.

The objective is depth rather than breadth.

Features unrelated to repository understanding are intentionally postponed.

---

## Explicitly Out of Scope

The MVP will **not** include:

* Source code editing.
* AI code generation.
* Pull request creation.
* CI/CD pipelines.
* Deployment automation.
* Project management.
* Issue tracking.
* Team chat.
* IDE replacement.
* Real-time collaborative editing.

These capabilities already exist in specialized tools.

DevLens integrates with them rather than replacing them.

---

# 7. Long-Term Vision

The first version of DevLens focuses on understanding repositories.

The long-term vision extends far beyond repository visualization.

Future versions may evolve into a comprehensive Software Intelligence Platform capable of understanding entire software ecosystems.

Potential future capabilities include:

* Multi-repository architecture analysis.
* Cross-service dependency visualization.
* Enterprise knowledge graphs.
* Organization-wide documentation.
* Architecture governance.
* Security impact analysis.
* Automated architectural reviews.
* AI-powered onboarding experiences.
* Custom AI Capabilities.
* Bring Your Own AI (BYOAI).
* Enterprise policy enforcement.

Despite this evolution, one principle must remain unchanged:

**Knowledge is always the foundation.**

Every future capability should build upon structured software knowledge rather than bypass it.

---

# 8. Core Features

DevLens is organized around a set of product capabilities instead of isolated pages or tools.

Every capability exists to improve software understanding.

---

## Repository Analysis

The entry point of every project.

Responsible for:

* Connecting Git repositories
* Cloning repositories
* Detecting changes
* Incremental indexing
* Background synchronization

The repository itself is never the product.

It is only the source of knowledge.

---

## Static Analysis Engine

Transforms source code into structured metadata.

Extracts:

* Modules
* Classes
* Interfaces
* Controllers
* Services
* DTOs
* Decorators
* API Endpoints
* Imports
* Dependencies
* Relationships

This process is deterministic.

No AI is involved.

---

## Knowledge Graph

The Knowledge Graph is the heart of DevLens.

It transforms isolated metadata into connected knowledge.

Every capability consumes the Knowledge Graph.

Not the repository.

The graph becomes the single source of truth for:

* AI
* Documentation
* Search
* Architecture
* Metrics
* Impact Analysis

---

## Architecture Explorer

The primary user interface.

Instead of navigating folders, developers navigate relationships.

Users should be able to visually understand:

* Modules
* Services
* APIs
* Dependencies
* Events
* Domain Boundaries
* Shared Components

Every visualization should answer a question.

Never exist for decoration.

---

## AI Assistant

The AI Assistant is a contextual interface over the Knowledge Graph.

It explains software.

It does not invent software.

Capabilities include:

* Explaining architecture
* Explaining services
* Explaining APIs
* Summarizing modules
* Answering repository questions
* Guiding onboarding
* Suggesting documentation
* Identifying architectural risks

Future capabilities will be introduced through the AI Capability Framework.

---

## Documentation Center

Documentation is generated automatically.

Supported outputs include:

* Markdown
* HTML
* OpenAPI
* AsyncAPI
* Mermaid
* PlantUML
* PDF

Documentation should always reflect the current repository.

Manual synchronization must never be required.

---

## API Explorer

Automatically discovers and documents APIs.

Capabilities include:

* Endpoint visualization
* Request/response schemas
* Authentication requirements
* Module ownership
* Dependency navigation

The API Explorer is generated directly from the analyzed project.

---

## Search

Search is a first-class capability.

Users should be able to search by:

* Module
* Service
* Endpoint
* Class
* File
* Dependency
* Documentation
* Architecture Node

Future versions will also include semantic search powered by embeddings.

---

## Architecture Metrics

DevLens continuously evaluates architectural quality.

Examples:

* Dependency cycles
* Coupling
* Cohesion
* Documentation coverage
* Layer violations
* Complexity
* Module size
* Architectural drift

Metrics should drive better engineering decisions.

Not vanity dashboards.

---

## Export Center

Every generated artifact should be exportable.

Supported formats include:

* Markdown
* HTML
* PDF
* OpenAPI
* AsyncAPI
* Mermaid
* PlantUML
* JSON

Users should never feel locked into the platform.

---

# 9. Business Model

## Philosophy

DevLens follows a Product-Led Growth strategy.

The free version should provide genuine value.

Paid plans unlock scale, collaboration and advanced intelligence.

The goal is to create long-term trust rather than forcing upgrades.

---

## Free

Designed for individual developers.

Includes:

* One repository
* Static analysis
* Knowledge Graph
* Architecture Explorer
* Documentation generation
* API Explorer
* Basic AI capabilities
* Markdown export
* Mermaid export

The free plan should be useful enough to recommend the product.

---

## Professional

Designed for freelancers, consultants and small teams.

Adds:

* Unlimited repositories
* Advanced AI Capabilities
* Architecture reports
* PDF exports
* Semantic search
* Repository comparison
* Historical analysis
* Advanced metrics
* Custom documentation templates
* Priority indexing

---

## Enterprise

Designed for organizations.

Adds:

* SSO
* RBAC
* Audit logs
* Organization-wide analytics
* Multi-repository analysis
* Private deployments
* Bring Your Own AI
* Custom integrations
* Compliance features
* SLA
* Dedicated support

Enterprise features should never complicate the experience of individual developers.

---

# Product Monetization Principles

Revenue should come from:

* Scale
* Collaboration
* Advanced analysis
* Enterprise integrations

Never from restricting essential understanding features.

Developers should trust the platform before paying for it.

---

# 10. Pricing Strategy

Pricing should remain simple.

Complex pricing increases friction.

The product should scale naturally with customer growth.

---

## Free Tier

Ideal for:

* Learning
* Personal projects
* Portfolio repositories
* Open source

---

## Professional Tier

Ideal for:

* Consultants
* Freelancers
* Startups
* Small engineering teams

Unlocks productivity improvements.

---

## Enterprise Tier

Ideal for:

* Medium and large organizations
* Regulated industries
* Internal platforms
* Private infrastructure

Focuses on governance rather than individual productivity.

---

## Pricing Principles

Pricing should reward value.

Not usage.

Avoid charging for:

* AI messages
* Number of diagrams
* Documentation exports

Instead, charge for:

* Collaboration
* Scale
* Organization features
* Enterprise integrations

---

# 11. Technology Stack

The selected technologies prioritize maintainability, portability and long-term scalability.

| Layer           | Technology                                  |
| --------------- | ------------------------------------------- |
| Frontend        | Next.js + React                             |
| Language        | TypeScript                                  |
| Backend         | NestJS                                      |
| Architecture    | Modular Monolith + DDD + Hexagonal          |
| Database        | PostgreSQL                                  |
| Cache           | Redis                                       |
| Background Jobs | BullMQ                                      |
| Event Streaming | Kafka *(optional)*                          |
| Object Storage  | S3-Compatible Storage (MinIO, AWS S3, etc.) |
| Search          | PostgreSQL Full Text + Embeddings           |
| AI              | Provider Abstraction Layer                  |
| Containers      | Docker                                      |
| Orchestration   | Docker Compose (MVP)                        |
| CI/CD           | GitHub Actions                              |

---

## Technology Principles

Every selected technology should satisfy at least one of these goals:

* Improve maintainability.
* Reduce operational complexity.
* Remain vendor independent.
* Be widely adopted.
* Have excellent documentation.

Technologies should never be chosen because they are fashionable.

---

# 12. High-Level Architecture

DevLens follows a layered architecture centered around knowledge generation.

## User-Facing Product Flow

This is the product as experienced by the user — from repository connection to knowledge consumption:

```text
Repository
        │
        ▼
Repository Intelligence Pipeline
        │
        ▼
Static Analysis
        │
        ▼
Knowledge Extraction
        │
        ▼
Visualization
        │
        ├────────────► AI Insights
        ├────────────► Documentation
        ├────────────► Search
        └────────────► Metrics
```

The user connects a repository. The platform ingests, analyzes, and extracts knowledge. The user then explores that knowledge through five integrated experiences — all consuming the same Knowledge Graph.

## Technical Architecture Flow

Under the hood, the pipeline is more granular. Each stage produces an artifact consumed by the next:

```text
Repository Snapshot
        │
        ▼
Language Detection
        │
        ▼
Parser
        │
        ▼
Abstract Syntax Tree (AST)
        │
        ▼
IR Builder
        │
        ▼
Intermediate Representation (IR)
        │
        ▼
Semantic Model Builder
        │
        ▼
Semantic Model
        │
        ▼
Knowledge Graph Builder
        │
        ▼
Knowledge Graph
        │
        ├────────────► Visualization Engine
        ├────────────► AI Orchestrator
        ├────────────► Documentation Engine
        ├────────────► Search Engine
        └────────────► Metrics Engine
```

For full technical details of each stage, see the architecture RFCs (RFC-005 through RFC-013) and the ROADMAP.md.

Everything begins with deterministic analysis.

Artificial Intelligence operates after structured knowledge exists.

---

## Architectural Characteristics

The platform is:

* Modular
* Domain-driven
* Event-aware
* Cloud agnostic
* Provider agnostic
* API-first
* Visualization-first

The architecture prioritizes simplicity over premature distribution.

---

## System Principles

* Modular Monolith first.
* Microservices only when justified.
* Heavy processing runs asynchronously.
* Every external dependency is replaceable.
* Infrastructure supports the domain—not the opposite.

---

# 13. AI Philosophy

Artificial Intelligence is an interface.

Not the product.

The product is structured software knowledge.

---

## AI Mission

Enable developers to understand software through natural language without sacrificing accuracy.

---

## AI Principles

### Knowledge Before Language

The model should receive structured context.

Never raw repositories whenever deterministic knowledge is available.

---

### Deterministic First

Prefer information extracted through static analysis over probabilistic inference.

The AI complements knowledge.

It does not replace it.

---

### Provider Independence

The AI layer should support multiple providers through a common abstraction.

Examples:

* Anthropic
* OpenAI
* Ollama
* Future providers

Changing providers should require configuration rather than architectural changes.

---

### Capability-Oriented AI

The AI should be organized around capabilities.

Examples:

* Explain Architecture
* Explain Service
* Summarize Module
* Generate Documentation
* Analyze Dependencies
* Estimate Impact

Each capability owns:

* Context strategy
* Prompt template
* Output format
* Validation rules

This keeps prompts small, maintainable and testable.

---

### AI Is Observable

Every AI request should be measurable.

Track:

* Latency
* Cost
* Token usage
* Selected provider
* Success rate
* Failure reason

AI should behave like any other production service.

---

# 14. Knowledge Graph Philosophy

The Knowledge Graph is the central asset of DevLens.

Every capability depends on it.

Nothing bypasses it unless absolutely necessary.

---

## Why a Knowledge Graph?

Repositories contain information.

Knowledge Graphs contain understanding.

The graph connects software concepts into meaningful relationships.

Examples:

Module → Service

Service → Endpoint

Endpoint → DTO

Controller → Domain

Domain → Repository

Repository → Organization

These relationships allow developers to reason about the system instead of searching through files.

---

## Source of Truth

The Knowledge Graph is generated from deterministic analysis.

It is continuously synchronized with the repository.

Every downstream capability should consume the graph instead of rebuilding knowledge independently.

---

## Relationship-Driven Thinking

DevLens is not centered around files.

It is centered around relationships.

Examples of questions the graph should answer:

* What depends on this module?
* Which services expose this endpoint?
* Which domain owns this aggregate?
* Which changes will impact authentication?
* Which modules communicate through events?

Understanding relationships is more valuable than understanding isolated files.

---

## Living Knowledge

The graph should evolve automatically as the repository evolves.

Users should never maintain it manually.

Every commit has the potential to improve or modify the graph.

The repository changes.

The graph follows.

The documentation updates.

The AI immediately benefits from the new knowledge.

---

# 15. Development Principles

The following principles guide every engineering decision.

---

## Build for Understanding

Every feature should help developers understand software better.

If a feature does not improve understanding, confidence, or discoverability, its value should be questioned.

---

## Simplicity Over Cleverness

Readable code is preferred over clever code.

Avoid unnecessary abstractions.

Avoid premature optimization.

Code should be understandable by a senior engineer unfamiliar with the project.

---

## Explicitness

Prefer explicit code over implicit behavior.

Examples:

* Explicit dependencies.
* Explicit interfaces.
* Explicit module boundaries.
* Explicit configuration.

Magic should be avoided whenever possible.

---

## Composition Over Inheritance

Favor composition.

Inheritance should be reserved for cases where it genuinely models an "is-a" relationship.

Deep inheritance hierarchies are prohibited.

---

## Progressive Evolution

Do not design for hypothetical future requirements.

However, design extension points where change is expected.

Examples:

* AI Providers
* Storage Providers
* Authentication Providers
* Export Providers

---

## Small Vertical Features

Every feature should be developed end-to-end.

Avoid implementing large horizontal layers without delivering user value.

---

## Vendor Independence

No core business logic may depend directly on:

* Cloud providers
* AI vendors
* Database vendors
* Queue implementations

Every external service must be accessed through an abstraction.

---

## Deterministic Before AI

Whenever deterministic information exists, prefer it over AI inference.

AI enhances knowledge.

It does not replace it.

---

## Performance Is Part of the Design

Performance should be considered from the beginning.

Never postpone obvious performance problems.

---

## Every Decision Must Be Explainable

If an architectural decision cannot be justified in a few sentences, reconsider it.

Complexity requires a clear benefit.

---

# 16. Coding Standards

The following standards apply to every code contribution.

---

## General

* TypeScript strict mode is mandatory.
* ESLint must pass.
* Prettier formatting is mandatory.
* No commented-out code.
* No dead code.
* No TODOs without an issue reference.

---

## Naming

Prefer descriptive names.

Good:

```text id="bqkqfa"
ProjectAnalysisService
RepositoryIndexJob
KnowledgeGraphBuilder
```

Avoid:

```text id="hpk9zh"
Manager
Helper
Util
CommonService
DataProcessor
```

Names should communicate responsibility.

---

## Functions

Functions should:

* Have a single responsibility.
* Be short.
* Return predictable results.
* Avoid hidden side effects.

---

## Classes

Classes should represent meaningful concepts.

Avoid "God Objects."

Large classes should be decomposed into smaller collaborators.

---

## Dependencies

Inject dependencies through constructors.

Avoid service locators.

Avoid global state.

---

## Value Objects

Primitive values with business meaning should become Value Objects.

Examples:

* RepositoryUrl
* Email
* ProjectName
* ApiPath

---

## Domain Events

Every significant business action should emit a Domain Event.

Events should describe facts.

Not commands.

---

## Comments

Code should explain **how**.

Comments should explain **why**.

If code requires excessive comments to be understood, simplify the implementation.

---

## Testing

Business logic must be testable without HTTP, databases or queues.

Pure domain logic should execute entirely in memory.

---

# 17. Non-Goals

The following are intentionally outside the scope of DevLens.

These limitations are deliberate.

---

DevLens is **not**:

* An IDE.
* A Git hosting platform.
* A CI/CD server.
* A project management tool.
* An issue tracker.
* A deployment platform.
* A code editor.
* An AI code generator.
* A replacement for GitHub.
* A replacement for Jira.
* A replacement for Confluence.

---

Artificial Intelligence should explain existing software.

It should not become another coding assistant.

---

# 18. Performance Goals

Performance is a product feature.

Users should perceive DevLens as responsive, even for large repositories.

---

## Frontend

Target metrics:

* Lighthouse ≥ 95
* First Contentful Paint < 1.5 s
* Largest Contentful Paint < 2.5 s
* Initial JavaScript kept as small as practical
* Route-level code splitting
* Lazy loading for visualization modules
* Virtualized rendering for large datasets

---

## Backend

Target metrics:

* API p95 latency < 250 ms (non-AI endpoints)
* Background processing for expensive operations
* Efficient database queries
* Pagination by default
* Streaming for long-running AI responses

---

## AI

* Stream responses whenever possible.
* Cache reusable context.
* Avoid unnecessary model calls.
* Prefer deterministic context over larger prompts.
* Measure latency and token usage.

---

## Visualization

Graph rendering should remain fluid.

Targets:

* Smooth zooming and panning.
* Incremental rendering.
* Progressive loading for large graphs.
* Stable interactions at 60 FPS where feasible.

---

# 19. Product Roadmap

The roadmap communicates direction, not deadlines.

---

## Phase 1 — MVP

Focus:

Repository understanding.

Includes:

* Repository connection
* Static analysis
* Knowledge Graph
* AI explanations
* Documentation generation
* Architecture visualization
* Search
* Export center
* Authentication
* Organizations and workspaces

---

## Phase 2 — Team Productivity

Focus:

Collaboration.

Potential additions:

* Shared workspaces
* Comments
* Saved views
* Team documentation
* Repository comparison
* Historical architecture

---

## Phase 3 — Enterprise

Focus:

Governance.

Potential additions:

* SSO
* RBAC enhancements
* Multi-repository graphs
* Audit logs
* Compliance
* BYO AI
* Private deployments

---

## Phase 4 — Software Intelligence Platform

Long-term evolution.

Potential additions:

* Cross-organization knowledge
* AI Capabilities Marketplace
* Architectural governance
* Security analysis
* Automated architecture reviews
* Predictive impact analysis

---

# 20. Architectural Rules

The following rules are mandatory.

---

## Product Rules

* The Knowledge Graph is the source of truth.
* AI consumes knowledge.
* AI never analyzes raw repositories when structured knowledge exists.
* Every feature should reinforce software understanding.
* Visual exploration is a first-class experience.

---

## Architecture Rules

* Modular Monolith first.
* Domain-Driven Design.
* Vertical Slice Architecture.
* Hexagonal Architecture.
* Domain never depends on Infrastructure.
* Infrastructure depends on the Domain.
* Every bounded context owns its data.
* Domain Events are transport agnostic.
* Kafka is optional infrastructure.
* BullMQ is the default background processing mechanism.
* Heavy work belongs in background jobs.

---

## AI Rules

* AI Providers must implement a shared interface.
* Providers must be replaceable through configuration.
* Prompt templates belong to AI Capabilities.
* AI Capabilities own their context strategy.
* Every AI request is observable.
* Streaming is preferred.
* Cost should be measurable.

---

## API Rules

* APIs are versioned.
* APIs are documented.
* Stable contracts take precedence over convenience.
* Breaking changes require explicit review.

---

## Documentation Rules

* Documentation is generated.
* Documentation reflects the current repository.
* Manual documentation should be minimized.
* Export formats remain vendor neutral.

---

## Code Quality Rules

* Prefer composition.
* Prefer explicitness.
* Avoid unnecessary abstractions.
* Avoid generic repositories.
* Avoid generic CRUD services.
* Avoid static utility classes for business logic.
* Keep modules cohesive.
* Respect bounded contexts.
* Every important business action emits a Domain Event.
* Business rules belong in the Domain.

---

## Dependency Rules

New dependencies should only be added when they:

* Solve a real problem.
* Have active maintenance.
* Are widely adopted.
* Improve maintainability.
* Align with the existing architecture.

Every additional dependency increases long-term maintenance cost.

---

# 21. AI Agent Instructions

This section is written specifically for AI coding assistants.

---

## Before Starting

Always:

1. Read `PRODUCT_CONTEXT.md`.
2. Read the relevant RFCs.
3. Inspect the existing code.
4. Reuse existing patterns before introducing new ones.

---

## During Development

Do not:

* Introduce technologies outside the approved stack.
* Invent architectural patterns.
* Bypass module boundaries.
* Couple the domain to infrastructure.
* Add unnecessary abstractions.
* Increase complexity without justification.

Always:

* Prefer readable code.
* Keep implementations simple.
* Follow DDD boundaries.
* Preserve backward compatibility where appropriate.
* Write deterministic business logic.
* Keep public APIs consistent.

---

## When Uncertain

If a requirement is ambiguous:

* Stop.
* Explain the ambiguity.
* Propose alternatives.
* Wait for clarification before implementing.

Avoid guessing.

---

## Code Generation Priorities

When multiple valid solutions exist, prioritize them in this order:

1. Correctness
2. Maintainability
3. Readability
4. Simplicity
5. Performance
6. Extensibility

Never sacrifice maintainability for minor performance gains.

---

## Definition of Done

A task is complete only if:

* The implementation satisfies the requested behavior.
* The architecture remains consistent.
* Existing conventions are respected.
* Public APIs remain coherent.
* Errors are handled appropriately.
* The code is understandable without excessive comments.

If any of these conditions are not met, the task is not finished.

---

# Final Notes

`PRODUCT_CONTEXT.md` is the foundational document for DevLens.

It captures the product vision, engineering philosophy, and immutable architectural principles that guide every decision.

Implementation details belong in the RFCs, but every RFC, feature, and pull request must remain aligned with this document.

Whenever a conflict arises between convenience and the principles defined here, **the principles take precedence**.

The objective is not only to build software, but to build a product that remains understandable, maintainable, and extensible for many years.
