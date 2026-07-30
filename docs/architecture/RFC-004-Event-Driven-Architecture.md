# RFC-004 — Event-Driven Architecture

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the event-driven architecture adopted by DevLens.

Events are the primary mechanism for asynchronous communication between bounded contexts. They allow independent modules to collaborate while preserving autonomy, scalability, and provider independence.

The event system is designed around business facts, explicit contracts, and transport-independent abstractions.

No bounded context should communicate directly with another through infrastructure-specific messaging technologies.

---

# 2. Motivation

DevLens is composed of multiple bounded contexts that evolve independently.

Examples include:

- Repository Management
- Static Analysis
- Knowledge Graph
- Documentation
- Visualization
- Search
- Architecture Metrics
- AI Orchestration
- Billing

These contexts must collaborate without introducing direct dependencies.

An event-driven architecture enables asynchronous workflows while allowing each module to remain independently deployable and testable.

---

# 3. Goals

The architecture must:

- Decouple bounded contexts.
- Support asynchronous workflows.
- Remain transport agnostic.
- Enable future distributed deployments.
- Preserve business consistency.
- Support horizontal scalability.
- Guarantee idempotent processing.
- Provide complete observability.
- Encourage explicit business communication.

---

# 4. Non-Goals

This RFC intentionally does not define:

- Kafka
- RabbitMQ
- NATS
- Redis Streams
- Queue configuration
- Retry infrastructure
- Topic naming conventions
- Broker deployment

These implementation decisions belong to Infrastructure and should be documented through ADRs when necessary.

---

# 5. Event Philosophy

Events represent facts.

They describe something that has already happened.

Events never express intentions.

Correct examples:

- RepositoryConnected
- RepositorySynchronized
- AnalysisCompleted
- KnowledgeGraphUpdated
- DocumentationGenerated

Incorrect examples:

- AnalyzeRepository
- GenerateDocumentation
- UpdateSearchIndex

Those are commands rather than events.

---

# 6. Event Categories

DevLens distinguishes three categories of events.

## Domain Events

Represent business facts inside a bounded context.

Examples:

- UserInvited
- SubscriptionActivated
- RepositoryConnected

These events normally remain internal.

---

## Integration Events

Represent facts intended for other bounded contexts.

Examples:

- RepositorySynchronized
- StaticAnalysisCompleted
- KnowledgeGraphUpdated
- DocumentationGenerated

These events define public contracts.

---

## System Events

Represent platform operational activities.

Examples:

- DeploymentCompleted
- BackupCompleted
- HealthCheckFailed

These events are not part of the business model.

---

# 7. Event Ownership

Every event has:

- One producer.
- Zero or more consumers.

Publishers never know who consumes their events.

Consumers never depend on publishers.

Ownership must always be explicit.

---

# 8. Event Bus Abstraction

All event communication must occur through a transport-independent Event Bus abstraction.

Business modules must never publish events directly to Kafka, RabbitMQ, or any messaging technology.

Instead, they interact only with the Event Bus contract provided by the Shared Kernel.

Conceptually, every Event Bus exposes capabilities similar to:

```text
EventBus

publish()

publishAll()

subscribe()
```

The Shared Kernel owns the abstraction.

Infrastructure provides the implementation.

Possible implementations include:

- In-Memory Event Bus
- Kafka Event Bus
- RabbitMQ Event Bus
- Future transports

Replacing the transport must never require changes to business logic.

---

# 9. Canonical Event Flow

Every asynchronous workflow follows the same conceptual lifecycle.

```text
Business Action
        │
        ▼
Domain Event
        │
        ▼
Integration Event
        │
        ▼
Shared Event Bus
        │
        ▼
Interested Consumers
```

Each stage has a single responsibility.

---

# 10. Event Envelope

Every Integration Event must include standardized metadata.

Required fields:

- Event ID
- Event Type
- Event Version
- Timestamp
- Correlation ID
- Causation ID
- Producer
- Payload

The payload contains only business-relevant information.

---

# 11. Event Versioning

Integration Events are public contracts.

Versioning rules:

- Existing versions are immutable.
- Breaking changes require a new version.
- Additive changes are preferred.
- Consumers migrate independently.

Published contracts should remain stable.

---

# 12. Idempotency

Consumers must assume events can be delivered multiple times.

Every consumer must therefore be idempotent.

Processing the same event multiple times must produce the same observable result.

Duplicate deliveries must never corrupt business state.

---

# 13. Ordering

Consumers must not rely on global event ordering.

Ordering may only be assumed when explicitly guaranteed within a single aggregate.

Business logic should tolerate eventual consistency.

---

# 14. Error Handling

Consumer failures must never affect publishers.

Errors should remain isolated.

Failed events should support retry mechanisms.

Poison messages should be isolated for inspection.

Recovery must preserve event consistency.

---

# 15. Observability

Every event should be observable.

The platform should expose:

- Published events
- Consumed events
- Processing duration
- Retry count
- Failed deliveries
- Dead-letter events
- Consumer health
- End-to-end latency

Observability should remain independent of the transport implementation.

---

# 16. Event Contracts

Integration Events are public contracts between bounded contexts.

They should be:

- Explicit
- Stable
- Versioned
- Documented
- Backward compatible whenever possible

Contract changes require architectural review.

---

# 17. Canonical Platform Flow

The primary DevLens workflow illustrates how bounded contexts collaborate through events.

```text
Repository Management
        │
        ▼
RepositorySynchronized
        │
        ▼
Shared Event Bus
        │
        ├──────────────► Static Analysis
        │                       │
        │                       ▼
        │               StaticAnalysisCompleted
        │                       │
        │                       ▼
        │               Shared Event Bus
        │
        ├──────────────► Knowledge Graph
        │                       │
        │                       ▼
        │              KnowledgeGraphUpdated
        │                       │
        │                       ▼
        │               Shared Event Bus
        │
        ├──────────────► Documentation
        │
        ├──────────────► Search
        │
        ├──────────────► Metrics
        │
        ├──────────────► Visualization
        │
        └──────────────► AI Cache Invalidation
```

Every bounded context reacts independently.

No consumer depends directly on another consumer.

---

# 18. Evolution Strategy

DevLens begins as a Modular Monolith.

The Event Bus abstraction allows the architecture to evolve without modifying business logic.

Expected evolution:

```text
Modular Monolith

        │

        ▼

Shared Event Bus

        │

        ▼

Distributed Event Bus

        │

        ▼

Independent Services
```

The transition should require only infrastructure changes.

Business modules remain unchanged.

---

# 19. Consequences

Adopting this architecture provides:

- Loose coupling.
- Independent bounded contexts.
- Provider independence.
- Easier testing.
- Better scalability.
- Improved resilience.
- Clear business workflows.
- Future service decomposition.

Trade-offs include:

- Eventual consistency.
- More complex debugging.
- Greater architectural discipline.

---

# 20. Future Evolution

Future RFCs should build upon this document.

Examples include:

- Repository Lifecycle
- Static Analysis Engine
- Knowledge Graph
- AI Orchestration
- Documentation Engine
- Search & Discovery
- Architecture Metrics

All future asynchronous workflows must comply with the principles established in this RFC.

---

# 21. References

- RFC-001 — Architecture Principles
- RFC-002 — System Architecture
- RFC-003 — Shared Kernel
- Future ADRs
