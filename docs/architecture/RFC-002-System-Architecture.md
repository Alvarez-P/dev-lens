# RFC-002 — System Architecture

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the high-level architecture of DevLens.

It describes how the platform is organized into bounded contexts, architectural layers, and independent services while remaining provider-agnostic, modular, and scalable.

The objective is to establish a stable architectural foundation that enables future evolution without introducing unnecessary coupling between domains.

---

# 2. Motivation

DevLens is designed to become a long-lived software platform composed of multiple independent capabilities, including repository management, static analysis, knowledge extraction, visualization, documentation generation, AI-assisted reasoning, search, metrics, and enterprise features.

Without a clear architectural model, these capabilities would gradually become tightly coupled, making future evolution increasingly difficult.

This RFC defines the structural organization of the system before discussing the implementation details of individual components.

---

# 3. Goals

The architecture must:

* Be domain-driven.
* Be modular.
* Support independent evolution of bounded contexts.
* Minimize coupling.
* Encourage high cohesion.
* Remain cloud agnostic.
* Support asynchronous communication.
* Allow provider replacement.
* Scale horizontally where appropriate.
* Keep business logic independent of frameworks.

---

# 4. Non-Goals

This RFC does not define:

* Programming languages.
* Frameworks.
* Infrastructure providers.
* Databases.
* Message brokers.
* AI providers.
* Deployment topology.
* CI/CD pipelines.

These concerns are addressed by dedicated RFCs or ADRs.

---

# 5. Architectural Style

DevLens adopts a combination of architectural styles rather than relying on a single pattern.

The architecture combines:

* Domain-Driven Design (DDD)
* Hexagonal Architecture
* Layered Architecture
* Event-Driven Architecture
* Modular Monolith (initially)
* Evolution toward distributed services when justified

No architectural decision should compromise the independence of the domain model.

---

# 6. High-Level Architecture

The platform is composed of independent bounded contexts that collaborate through explicit contracts.

```text
                         +----------------------+
                         |      Frontend        |
                         +----------+-----------+
                                    |
                                    |
                         +----------v-----------+
                         |      Public API      |
                         +----------+-----------+
                                    |
        ---------------------------------------------------------
        |            |             |            |                |
        v            v             v            v                v
+---------------+ +---------------+ +---------------+ +---------------+
|   Identity    | | Repositories  | | Intelligence  | | Documentation |
+---------------+ +---------------+ +---------------+ +---------------+
        |                    |                |                 |
        |                    |                |                 |
        ---------------------------------------------------------
                                    |
                                    v
                          +----------------------+
                          | Shared Infrastructure|
                          +----------------------+
```

Each bounded context owns its business logic, persistence model, and public interfaces.

---

# 7. Bounded Contexts

The platform is organized into the following primary bounded contexts.

## Identity

Responsible for:

* Authentication
* Authorization
* Organizations
* Users
* Roles
* Permissions

---

## Repository Management

Responsible for:

* Git providers
* Repository lifecycle
* Synchronization
* Repository metadata

---

## Static Analysis

Responsible for:

* Source code parsing
* Metadata extraction
* Intermediate Representation (IR)

---

## Knowledge Graph

Responsible for:

* Software graph construction
* Relationship management
* Graph queries
* Incremental graph updates

---

## Visualization

Responsible for:

* Interactive architecture views
* Graph rendering
* Navigation
* User exploration

---

## AI

Responsible for:

* AI orchestration
* Capability execution
* Context retrieval
* Provider abstraction

---

## Documentation

Responsible for:

* Documentation generation
* Export formats
* Template management

---

## Search

Responsible for:

* Search indexing
* Discovery
* Navigation

---

## Metrics

Responsible for:

* Architecture metrics
* Repository health
* Trend analysis

---

## Billing

Responsible for:

* Licensing
* Subscription management
* Feature access

---

# 8. Layered Architecture

Every bounded context follows the same internal structure.

```text
Presentation
      │
Application
      │
Domain
      │
Infrastructure
```

## Presentation

Exposes APIs and user-facing interfaces.

Contains no business logic.

---

## Application

Coordinates use cases.

Orchestrates workflows.

Does not contain business rules.

---

## Domain

Contains business rules.

Defines aggregates, entities, value objects, domain services, and domain events.

This layer is independent from frameworks.

---

## Infrastructure

Implements external integrations.

Examples include:

* Persistence
* External APIs
* File systems
* Queues
* AI providers
* Storage

---

# 9. Communication

Communication follows these principles:

* Synchronous communication for immediate consistency.
* Asynchronous communication for cross-context collaboration.
* Explicit contracts between bounded contexts.
* No direct access to another context's persistence.

Every dependency should point inward toward the domain.

---

# 10. Dependency Rules

The following rules are mandatory:

* Outer layers may depend on inner layers.
* Inner layers must never depend on outer layers.
* Domains never depend on infrastructure.
* Business rules never depend on frameworks.
* Bounded contexts communicate only through published contracts.
* Shared code belongs exclusively in the Shared Kernel.

---

# 11. Evolution Strategy

DevLens should evolve incrementally.

The preferred evolution path is:

```text
Modular Monolith
        │
        ▼
Event-Driven Modules
        │
        ▼
Independent Services (when justified)
```

Premature distribution should be avoided.

The architecture should support future decomposition without requiring fundamental redesign.

---

# 12. Consequences

This architecture provides:

* Strong separation of concerns.
* Independent evolution of modules.
* High maintainability.
* Reduced coupling.
* Improved testability.
* Provider independence.
* Long-term scalability.

The trade-off is additional architectural discipline and a greater emphasis on explicit boundaries.

---

# 13. Future Evolution

Future RFCs will expand on specific architectural areas, including:

* Shared Kernel
* Event-Driven Architecture
* Repository Lifecycle
* Static Analysis Engine
* Knowledge Graph
* Visualization Engine
* AI Orchestration
* AI Capability Architecture
* Documentation Engine
* Search & Discovery
* Architecture Metrics
* Licensing Architecture
* Enterprise Architecture

This RFC intentionally remains technology-agnostic and should remain stable as the platform evolves.

---

# 14. References

* RFC-001 — Architecture Principles
* PRODUCT_CONTEXT.md
* MANIFESTO.md
* VISION.md
