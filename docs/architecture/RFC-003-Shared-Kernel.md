# RFC-003 — Shared Kernel

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Shared Kernel used across all bounded contexts in DevLens.

The Shared Kernel contains reusable building blocks that are independent of any specific business domain. Its purpose is to promote consistency, reduce duplication, and provide common architectural abstractions while preserving bounded context autonomy.

The Shared Kernel must remain intentionally small and highly stable.

---

# 2. Motivation

As the platform grows, multiple bounded contexts will require common capabilities such as error handling, domain events, identifiers, validation, logging, and observability.

Duplicating these concerns increases maintenance costs and creates inconsistencies.

Conversely, placing too much logic into a shared module creates tight coupling between domains.

This RFC defines what belongs—and equally important, what does **not** belong—in the Shared Kernel.

---

# 3. Goals

The Shared Kernel must:

- Provide common architectural abstractions.
- Promote consistency across bounded contexts.
- Avoid business knowledge.
- Minimize coupling.
- Be highly stable.
- Be framework independent.
- Be reusable by every module.
- Remain easy to understand.

---

# 4. Non-Goals

The Shared Kernel must **not** contain:

- Business logic.
- Domain services.
- Use cases.
- Infrastructure implementations.
- Feature-specific utilities.
- Repository implementations.
- Controllers.
- AI logic.
- Framework-specific code.
- Generic helper functions without architectural value.

If a component belongs to a single bounded context, it does not belong in the Shared Kernel.

---

# 5. Design Principles

The Shared Kernel follows these principles:

- Small over comprehensive.
- Stable over flexible.
- Explicit over implicit.
- Reusable over convenient.
- Framework agnostic.
- Domain independent.

Every addition should be justified by reuse across multiple bounded contexts.

---

# 6. Shared Components

The Shared Kernel is organized into the following categories.

## Core

Common foundational abstractions.

Examples include:

- Unique Identifier abstraction.
- Base Entity.
- Aggregate Root.
- Value Object.
- Domain Event.
- Domain Exception.
- Domain Error.
- Result pattern.
- Either pattern.

These abstractions establish a consistent domain model throughout the platform.

---

## Contracts

Common interfaces shared across multiple contexts.

Examples include:

- Clock abstraction.
- Identifier generator.
- Event publisher.
- Logger.
- Configuration provider.
- Current user provider.
- Correlation ID provider.

Contracts define behavior without prescribing implementations.

---

## Validation

Shared validation primitives.

Examples include:

- Validation Result.
- Validation Error.
- Validation Pipeline.
- Validation Exception.

Business-specific validation remains inside each bounded context.

---

## Error Handling

Provide a unified error model.

Errors should be:

- Explicit.
- Typed.
- Predictable.
- Serializable.

Unexpected exceptions should never become part of normal business flow.

---

## Messaging

Shared abstractions for messaging.

Examples include:

- Domain Event.
- Integration Event.
- Event Metadata.
- Event Envelope.
- Event Serializer.

Concrete messaging technologies are intentionally excluded.

---

## Request Context

Provide a consistent execution context across the platform.

The request context may include:

- Correlation ID.
- Request ID.
- User ID.
- Organization ID.
- Workspace ID.
- Timestamp.

Business modules should obtain contextual information through this abstraction.

---

## Observability

Common abstractions for:

- Structured logging.
- Metrics.
- Tracing.
- Audit events.

Observability providers belong to Infrastructure.

Only the contracts belong to the Shared Kernel.

---

## Feature Flags

Provide framework-independent abstractions for feature evaluation.

Feature definitions remain outside the Shared Kernel.

---

## Configuration

Provide abstractions for retrieving configuration values.

Configuration sources remain infrastructure concerns.

---

# 7. Dependency Rules

The following dependency rules are mandatory.

Every bounded context may depend on the Shared Kernel.

The Shared Kernel must never depend on:

- Any bounded context.
- Infrastructure.
- Frameworks.
- External providers.

The dependency graph must always point toward the Shared Kernel.

---

# 8. Package Organization

The Shared Kernel should be organized around architectural concepts rather than technical utilities.

Example structure:

```text
shared-kernel/
│
├── core/
│   ├── entity/
│   ├── aggregate/
│   ├── value-object/
│   ├── result/
│   ├── either/
│   └── identifier/
│
├── contracts/
│
├── events/
│
├── errors/
│
├── validation/
│
├── context/
│
├── observability/
│
├── configuration/
│
└── feature-flags/
```

The package structure should remain stable as the platform evolves.

---

# 9. What Does Not Belong

The following examples should never be added to the Shared Kernel:

- Repository implementations.
- HTTP clients.
- ORM models.
- Database helpers.
- Framework decorators.
- Authentication providers.
- Queue implementations.
- Git integrations.
- AI providers.
- Cache implementations.
- File storage implementations.
- Business utilities.

These belong to specific bounded contexts or infrastructure layers.

---

# 10. Evolution Strategy

The Shared Kernel should evolve slowly.

Every proposed addition must satisfy all of the following:

- Used by multiple bounded contexts.
- Independent of business rules.
- Independent of infrastructure.
- Stable over time.
- Architecturally meaningful.

If any condition is not satisfied, the component should remain within its owning bounded context.

---

# 11. Consequences

Adopting a disciplined Shared Kernel provides:

- Consistent architectural patterns.
- Reduced duplication.
- Lower coupling.
- Easier onboarding.
- Predictable domain modeling.
- Improved maintainability.

The primary trade-off is resisting the temptation to place convenience utilities into the Shared Kernel.

---

# 12. Future Evolution

Future RFCs may extend the Shared Kernel with additional architectural abstractions, provided they remain domain-independent and broadly reusable.

Any significant expansion should be reviewed carefully to prevent the Shared Kernel from becoming a general-purpose utility library.

---

# 13. References

- RFC-001 — Architecture Principles
- RFC-002 — System Architecture
- Future ADRs
