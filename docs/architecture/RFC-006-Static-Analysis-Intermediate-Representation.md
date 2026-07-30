````markdown
# RFC-006 — Static Analysis & Intermediate Representation

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Static Analysis Engine and the Intermediate Representation (IR), the canonical software model used throughout DevLens.

The purpose of the Static Analysis Engine is not to generate reports or metrics directly, but to transform source code into a deterministic, language-independent representation that can be consumed by every downstream capability.

The Intermediate Representation is the primary output of static analysis and the only model exposed to subsequent architectural components.

---

# 2. Motivation

Programming languages expose different syntactic structures and Abstract Syntax Trees (ASTs).

Directly consuming language-specific ASTs would tightly couple every downstream component to parser implementations, making multi-language support difficult and increasing maintenance costs.

The Intermediate Representation provides a stable semantic model that abstracts language syntax into software concepts understood by the platform.

Every downstream component should consume the IR rather than language-specific ASTs.

---

# 3. Goals

The Static Analysis Engine must:

- Produce deterministic analysis results.
- Be language independent.
- Support incremental analysis.
- Generate immutable Intermediate Representations.
- Separate parsing from semantic modeling.
- Enable future language support.
- Minimize duplicated analysis work.

---

# 4. Non-Goals

This RFC does not define:

- Knowledge Graph construction.
- Architecture metrics.
- Documentation generation.
- Visualization.
- AI reasoning.
- Search indexing.

Those capabilities consume the Intermediate Representation but are implemented independently.

---

# 5. Analysis Pipeline

Every repository follows the same deterministic pipeline.

```text
Repository Snapshot
        │
        ▼
Language Detection
        │
        ▼
Language Parser
        │
        ▼
Abstract Syntax Tree (AST)
        │
        ▼
IR Builder
        │
        ▼
Intermediate Representation
        │
        ▼
StaticAnalysisCompleted Event
```

Each stage has a single responsibility.

---

# 6. Responsibilities

The Static Analysis bounded context is responsible for:

- Language detection.
- Source parsing.
- AST generation.
- Semantic extraction.
- Intermediate Representation construction.
- Incremental analysis.
- Analysis validation.
- Publishing analysis events.

It is not responsible for interpreting or visualizing the resulting model.

---

# 7. Intermediate Representation

The Intermediate Representation (IR) is the canonical software model used by DevLens.

It abstracts implementation syntax into architectural concepts.

The IR must remain:

- Deterministic.
- Immutable.
- Serializable.
- Language independent.
- Stable across parser implementations.

The IR is considered the contract between Static Analysis and every downstream bounded context.

---

# 8. IR Design Principles

The IR follows these principles:

- Represent semantics rather than syntax.
- Ignore language-specific implementation details.
- Preserve architectural meaning.
- Avoid framework-specific concepts.
- Prefer explicit relationships.
- Remain extensible without breaking existing consumers.

---

# 9. Canonical Software Concepts

The IR should represent concepts rather than language constructs.

Examples include:

- Project
- Package
- Module
- Namespace
- Class
- Interface
- Function
- Method
- Property
- Controller
- Service
- Repository
- Entity
- Aggregate
- Value Object
- DTO
- Event
- Command
- Query
- API Endpoint
- Dependency
- Annotation / Decorator
- Import
- Export

New concepts may be introduced without affecting existing consumers.

---

# 10. Relationships

The IR must explicitly model relationships between software concepts.

Examples include:

- Depends On
- Implements
- Extends
- Calls
- References
- Publishes Event
- Consumes Event
- Owns
- Contains
- Imports
- Exports

Relationships are first-class citizens of the IR.

---

# 11. Language Independence

Every supported programming language implements its own analysis pipeline.

```text
TypeScript
        │
        ▼
TypeScript Parser
        │
        ▼
TypeScript AST
        │
        ▼
TypeScript IR Builder
        │
        ▼
Intermediate Representation

Go
        │
        ▼
Go Parser
        │
        ▼
Go AST
        │
        ▼
Go IR Builder
        │
        ▼
Intermediate Representation

Python
        │
        ▼
Python Parser
        │
        ▼
Python AST
        │
        ▼
Python IR Builder
        │
        ▼
Intermediate Representation
```

Every downstream bounded context consumes exactly the same IR.

---

# 12. Incremental Analysis

The engine should avoid full repository analysis whenever possible.

Incremental analysis should detect:

- Modified files.
- Added files.
- Deleted files.
- Renamed files.

Only affected portions of the IR should be regenerated.

---

# 13. Immutability

Every analysis produces an immutable Intermediate Representation.

The IR should never be modified after publication.

Subsequent repository changes generate a new IR version.

This enables:

- Historical comparisons.
- Reproducible analysis.
- Architecture evolution.
- Version-aware documentation.

---

# 14. Validation

Before publishing the IR, the engine should validate:

- Structural consistency.
- Relationship integrity.
- Identifier uniqueness.
- Referential integrity.
- Required metadata.

Invalid IRs must never be published.

---

# 15. Integration Events

The Static Analysis context publishes events that describe analysis completion.

Examples include:

- StaticAnalysisStarted
- StaticAnalysisCompleted
- StaticAnalysisFailed

Consumers react independently.

No downstream module is invoked directly.

---

# 16. Consumers

The Intermediate Representation is consumed by:

- Knowledge Graph
- Documentation Engine
- Search & Discovery
- Architecture Metrics
- Visualization Engine
- AI Orchestration
- Future Plugins

No consumer should depend directly on ASTs or language parsers.

---

# 17. Observability

The analysis engine should expose metrics including:

- Analysis duration.
- Parsing duration.
- IR generation duration.
- Files analyzed.
- Incremental reuse ratio.
- Analysis failures.
- Supported language distribution.

All analysis executions should be traceable using Correlation IDs.

---

# 18. Consequences

Adopting an Intermediate Representation provides:

- Language independence.
- Stable downstream contracts.
- Easier parser replacement.
- Simplified multi-language support.
- Better architectural consistency.
- Incremental processing.
- Improved maintainability.

The trade-off is the additional complexity of maintaining a canonical semantic model.

---

# 19. Future Evolution

Future RFCs should consume the Intermediate Representation rather than language-specific artifacts.

The IR may evolve by introducing new concepts or relationships, provided backward compatibility is preserved whenever possible.

Adding support for a new programming language should require only a new parser and IR Builder, without changes to downstream bounded contexts.

---

# 20. References

- RFC-001 — Architecture Principles
- RFC-002 — System Architecture
- RFC-003 — Shared Kernel
- RFC-004 — Event-Driven Architecture
- RFC-005 — Repository Intelligence Pipeline
````
