# Delta for Intermediate Representation

## ADDED Requirements

### Requirement: IrEnrichment Artifact

The IR SHALL remain structurally unchanged. AI enrichment SHALL be persisted as a separate, additive `IrEnrichment` artifact keyed by the file manifest (`sha256`), versioned, and merged downstream into the semantic model — never mutating the IR. Enrichment SHALL record framework, architecture, per-class roles, per-endpoint lifecycle, and DTO types.

#### Scenario: Enrichment stored separately from IR

- GIVEN a validated IR and successful enrichment output
- WHEN the enrichment stage persists its result
- THEN an `IrEnrichment` artifact SHALL be stored keyed by manifest sha256
- AND the IR itself SHALL be unmodified

### Requirement: AI-Overridable Roles

Role classification SHALL be AI-overridable per unit. When enrichment provides a role for an IR node, the enriched role SHALL take precedence downstream; when enrichment is absent, the deterministic role SHALL remain. Unresolvable enriched references MUST NOT be persisted.

#### Scenario: Enriched role takes precedence downstream

- GIVEN an IR node with deterministic role `service` and enrichment role `interceptor`
- WHEN the semantic model is built
- THEN the node SHALL be typed `interceptor`

#### Scenario: Absent enrichment keeps deterministic role

- GIVEN an IR node with deterministic role `controller` and no enrichment
- WHEN the semantic model is built
- THEN the node SHALL be typed `controller`
