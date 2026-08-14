# RFC-013 — Architecture Metrics

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Architecture Metrics Engine, the bounded context responsible for computing quantitative indicators of software architecture health from the Knowledge Graph.

Metrics in DevLens are not vanity dashboards. They are diagnostic tools that help developers identify risks, monitor trends, and make informed architectural decisions. Every metric is deterministic, explainable, and reproducible from the Knowledge Graph.

No AI is used in metric computation.

---

# 2. Motivation

Software architecture decays gradually. Without measurement, this decay is invisible until it causes problems:

- A dependency cycle that seemed harmless grows to encompass 20 modules.
- A module that started with 200 lines grows to 5000 lines, becoming a bottleneck.
- Layer violations accumulate as shortcuts are taken during tight deadlines.

Architecture metrics make this decay visible and measurable. They transform subjective assessments ("this codebase feels messy") into objective indicators that teams can track, discuss, and act upon.

---

# 3. Goals

The Architecture Metrics Engine must:

- Compute metrics deterministically from the Knowledge Graph.
- Track metrics over time (historical snapshots per commit).
- Detect architectural violations against defined rules.
- Provide actionable insights — not just numbers.
- Support configurable thresholds and alerting.
- Export metrics for external tools and dashboards.
- Remain performant for large repositories.
- Never use AI in metric computation.

---

# 4. Non-Goals

This RFC does **not** define:

- How the Knowledge Graph is built (see RFC-007).
- How metrics are visualized (see RFC-008).
- Code quality metrics (test coverage, lint scores) — these belong in CI/CD.
- Runtime metrics (latency, error rates) — these belong in observability.
- Business metrics (velocity, cycle time) — these belong in project management.

Architecture Metrics focuses exclusively on structural properties derived from the Knowledge Graph.

---

# 5. Metric Categories

## 5.1 Size Metrics

Measure the scale of the codebase:

| Metric          | Description                               |
| --------------- | ----------------------------------------- |
| **Modules**     | Total number of modules/packages          |
| **Services**    | Total number of service classes           |
| **Controllers** | Total number of controllers/handlers      |
| **Endpoints**   | Total number of API endpoints             |
| **Entities**    | Total number of domain entities           |
| **Events**      | Total number of domain/integration events |
| **Files**       | Total number of source files              |
| **LOC**         | Total lines of code (from IR metadata)    |

## 5.2 Complexity Metrics

Measure structural complexity:

| Metric                              | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| **Cyclomatic Complexity**           | Average and max complexity per function/method (from IR)      |
| **Cognitive Complexity**            | Nesting depth, branching complexity (from IR)                 |
| **Depth of Inheritance**            | Maximum inheritance chain depth                               |
| **Afferent Couplings (Ca)**         | Number of modules that depend on this module                  |
| **Efferent Couplings (Ce)**         | Number of modules this module depends on                      |
| **Instability (I)**                 | Ce / (Ca + Ce) — 0 = maximally stable, 1 = maximally unstable |
| **Abstractness (A)**                | Ratio of abstract classes/interfaces to total classes         |
| **Distance from Main Sequence (D)** |                                                               | A + I - 1 | — ideal is near 0 |

## 5.3 Dependency Metrics

Measure inter-module relationships:

| Metric                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| **Dependency Count**         | Total directed dependencies                            |
| **Circular Dependencies**    | Number and size of dependency cycles                   |
| **Maximum Dependency Depth** | Longest transitive dependency chain                    |
| **Highly Coupled Modules**   | Modules with > N dependencies (configurable threshold) |
| **God Modules**              | Modules depended on by > N other modules (hub nodes)   |
| **Orphan Modules**           | Modules with zero dependencies and zero dependents     |

## 5.4 Architecture Compliance

Measure adherence to defined architectural rules:

| Metric                         | Description                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **Layer Violations**           | Dependencies that cross architectural layer boundaries in the wrong direction |
| **Domain Boundary Violations** | Dependencies between bounded contexts that should be isolated                 |
| **Cyclic Domain Dependencies** | Cycles between bounded contexts                                               |
| **Convention Violations**      | Naming convention violations, file structure violations                       |
| **Undocumented Endpoints**     | Endpoints without associated documentation                                    |
| **Undocumented Events**        | Events without associated documentation                                       |

## 5.5 Documentation Coverage

Measure documentation completeness:

| Metric                            | Description                                        |
| --------------------------------- | -------------------------------------------------- |
| **Module Documentation Coverage** | Percentage of modules with generated documentation |
| **API Documentation Coverage**    | Percentage of endpoints documented                 |
| **Event Documentation Coverage**  | Percentage of events documented                    |
| **README Completeness**           | Whether the project has a generated README         |

---

# 6. Architecture Score

The Architecture Score is a composite indicator of overall architecture health.

## 6.1 Scoring Model

The score is a weighted average of normalized sub-scores:

| Dimension         | Weight | Metrics                                                    |
| ----------------- | ------ | ---------------------------------------------------------- |
| **Modularity**    | 25%    | Instability distribution, god modules, orphan modules      |
| **Coupling**      | 25%    | Circular dependencies, afferent/efferent coupling averages |
| **Complexity**    | 20%    | Cyclomatic complexity, cognitive complexity distribution   |
| **Compliance**    | 15%    | Layer violations, domain boundary violations               |
| **Documentation** | 15%    | Documentation coverage                                     |

## 6.2 Score Range

- **A (90-100)**: Excellent architecture. Low coupling, high cohesion, clean boundaries.
- **B (75-89)**: Good architecture. Minor issues, no systemic problems.
- **C (60-74)**: Fair architecture. Some structural issues, manageable technical debt.
- **D (40-59)**: Poor architecture. Significant coupling, multiple violations.
- **F (0-39)**: Critical architecture debt. Systemic problems requiring immediate attention.

## 6.3 Score Trends

The Architecture Score is tracked over time (per commit). A declining score signals architectural erosion. An improving score signals successful refactoring.

---

# 7. Rule Engine

The Metrics Engine includes a configurable rule engine for detecting architectural violations.

## 7.1 Rule Definition

```yaml
rules:
  - id: no-domain-dependency-cycles
    description: Bounded contexts must not have circular dependencies
    severity: error
    check: graph.cycles(contexts)

  - id: no-infrastructure-from-domain
    description: Domain layer must not depend on infrastructure
    severity: error
    check: graph.dependencies(from: "domain", to: "infrastructure")

  - id: max-module-dependencies
    description: Modules should not depend on more than 15 other modules
    severity: warning
    threshold: 15
    check: graph.dependency_count(module) > threshold

  - id: max-module-size
    description: Modules should not exceed 1000 lines
    severity: warning
    threshold: 1000
    check: module.loc > threshold
```

## 7.2 Built-in Rules

The engine ships with a set of default rules based on common architecture patterns:

- Clean Architecture layer dependency direction.
- Hexagonal Architecture port/adapter separation.
- DDD bounded context isolation.
- General modularity best practices.

## 7.3 Custom Rules

Organizations can define custom rules:

- Rule files stored per organization/workspace.
- Rules can reference any Knowledge Graph query.
- Custom severity levels and thresholds.

---

# 8. Historical Tracking

## 8.1 Metric Snapshots

Each time the Knowledge Graph is updated, metrics are recomputed and stored as a snapshot:

- `/{organization_id}/{repository_id}/{commit_sha}/metrics.json`
- Snapshot includes all computed metrics and the Architecture Score.

## 8.2 Trend Analysis

Historical snapshots enable:

- **Trend charts**: metric values over time (line charts showing score evolution).
- **Anomaly detection**: sudden metric changes (e.g., dependency count spikes after a large merge).
- **Release comparisons**: "How did the architecture change between v1.5 and v2.0?"
- **Refactoring impact**: "Did the refactoring actually reduce coupling?"

## 8.3 Retention Policy

Snapshots are retained indefinitely by default. Configurable retention for organizations with storage constraints.

---

# 9. Integration Points

## 9.1 Visualization Engine (RFC-008)

- Metrics can be overlaid on the graph (node color = coupling score, node size = complexity).
- Architecture Score displayed prominently in the UI.
- Violations highlighted on the graph.

## 9.2 Documentation Engine (RFC-011)

- Metrics reports can be exported as part of generated documentation.
- Architecture Score included in the Architecture Guide.

## 9.3 AI Orchestration (RFC-009)

- AI can explain metric values: "Why does this module have high coupling?"
- AI can suggest remediation: "How can I reduce the coupling in this module?"

## 9.4 External Tools

- Metrics API for integration with dashboards (Grafana, Datadog).
- Webhook notifications for score changes and violation detection.
- Export in JSON, CSV, and Prometheus-compatible formats.

---

# 10. Performance

Metric computation is a background operation:

- Triggered by `KnowledgeGraphBuilt` or `KnowledgeGraphUpdated` events.
- Executed via BullMQ jobs.
- Incremental computation where possible (only recompute metrics for changed subgraphs).

Target computation times:

| Repository Size          | Target       |
| ------------------------ | ------------ |
| Small (< 100 modules)    | < 5 seconds  |
| Medium (100-500 modules) | < 30 seconds |
| Large (500+ modules)     | < 2 minutes  |

---

# 11. Alerting

Configurable alerts notify teams of architectural degradation:

| Alert               | Trigger                                      |
| ------------------- | -------------------------------------------- |
| Score Drop          | Architecture Score decreases by > 5 points   |
| New Cycle           | A new circular dependency is detected        |
| Layer Violation     | A new layer violation is introduced          |
| God Module          | A module exceeds the dependency threshold    |
| Undocumented Growth | Documentation coverage drops below threshold |

Alerts can be delivered via:

- In-app notifications.
- Email.
- Webhook (for integration with Slack, Teams, etc.).

---

# 12. Future Considerations

- **Predictive metrics**: forecast architecture degradation based on historical trends.
- **Cross-repository metrics**: analyze coupling across multiple repositories in an organization.
- **Industry benchmarks**: compare metrics against anonymized aggregates from other organizations.
- **Custom scoring models**: organizations define their own Architecture Score formula.
- **Metric-based gates**: block PRs that would degrade the Architecture Score below a threshold (CI/CD integration).
- **Runtime correlation**: combine structural metrics with runtime metrics (latency, error rates) for holistic architecture health.

---

# 13. References

- RFC-001 — Architecture Principles
- RFC-007 — Knowledge Extraction Platform
- EPIC-011 — Architecture Metrics
- PRODUCT_CONTEXT.md — Section 8 (Architecture Metrics)
