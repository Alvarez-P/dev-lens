# ai-capability-framework Specification

> **Archived from**: `epic-008-ai-orchestration` (2026-08-10)

## Purpose

Define AI capabilities as versioned, registered, discoverable operations — each owning its context strategy, prompt template, output format, and validation rules. Provide the `CapabilityRegistry` for registration and lookup. Per RFC-010 §5.

## Requirements

| #   | Requirement                               | Strength |
| --- | ----------------------------------------- | -------- |
| R1  | AICapability definition structure         | MUST     |
| R2  | CapabilityRegistry interface              | MUST     |
| R3  | Output format types                       | MUST     |
| R4  | Validation rule types                     | MUST     |
| R5  | Capability gating (MVP: enabled/disabled) | SHOULD   |

### Requirement: AICapability Definition

An `AICapability` MUST have: `id` (unique slug), `name`, `description`, `version` (semver), `contextStrategy` (target node type, relationship depth, flags per RFC-010 §5.2), `promptTemplate` (system instruction, context placeholder, capability instructions), `outputFormat` (text|markdown|json), `validationRules` (array of ValidationRule), and `enabled` (boolean). The `tier` field SHALL default to `"free"` and gating logic is deferred until the tier model exists.

#### Scenario: Register and retrieve a capability by ID

- GIVEN a capability `explain-module` registered with version 1
- WHEN `registry.get("explain-module")` is called
- THEN the returned capability has all required fields populated
- AND its `contextStrategy` and `promptTemplate` are non-null

#### Scenario: List all enabled capabilities

- GIVEN 3 capabilities registered, 1 disabled
- WHEN `registry.list()` is called
- THEN only the 2 enabled capabilities are returned

### Requirement: CapabilityRegistry Interface

The system MUST provide a `CapabilityRegistry` with: `register(capability)`, `get(id)`, `list(enabledOnly?)`, and `isAvailable(id)`. Registration SHALL reject duplicate IDs. Lookup of unknown IDs SHALL throw `CapabilityNotFoundError`.

#### Scenario: Duplicate ID registration rejected

- GIVEN a capability with ID "explain-module" already registered
- WHEN another capability with the same ID is registered
- THEN a `DuplicateCapabilityError` is raised

### Requirement: Output Format Types

Output formats MUST include: `text` (plain string), `markdown` (formatted with optional frontmatter), and `json` (validated via class-validator DTO). JSON output formats SHALL specify the DTO class for post-generation validation. JSONSchema/ajv support is deferred.

#### Scenario: JSON output validated against DTO

- GIVEN a capability with `outputFormat: { type: "json", dto: LifecycleEnrichmentDto }`
- WHEN the AI response is parsed
- THEN it passes through `class-validator` `validate()` and rejects with `AIDidNotMeetSchema` on failure

### Requirement: Validation Rule Types

Validation rules supported in MVP: `completeness` (required fields present), `schema` (class-validator DTO), `length` (max chars), `safety` (basic pattern blocklist), and `groundedness` (entities referenced must exist in provided context). All rules SHALL return a `ValidationResult` (passed + list of violations).

#### Scenario: Groundedness check catches hallucination

- GIVEN AI response references entity "BillingModule" not present in context
- WHEN the groundedness rule runs
- THEN it returns a violation: `"BillingModule" not found in context`

### Requirement: Capability Gating (MVP)

For MVP, capabilities SHALL gate on `enabled: true|false` only. Tier-based gating (`free|professional|enterprise`) is deferred. The registry's `isAvailable(id)` SHALL return false for disabled capabilities.

#### Scenario: Disabled capability unavailable

- GIVEN capability "analyze-impact" has `enabled: false`
- WHEN `registry.isAvailable("analyze-impact")` is called
- THEN it returns `false`

> **Cross-reference**: ai-context-assembly consumes `contextStrategy`. ai-prompt-management consumes `promptTemplate`. Deferred: tier model gating (RFC-010 §9).
