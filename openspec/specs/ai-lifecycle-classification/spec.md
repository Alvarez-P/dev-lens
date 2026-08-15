# AI Lifecycle Classification Specification

> **Archived from**: `ai-lifecycle-analysis` (2026-08-14)

## Purpose

The `classify-lifecycle` capability uses an LLM to classify framework/architecture, map per-endpoint request lifecycle, and extract DTO types over the structural IR. It is the first concrete AI capability and follows RFC-010's versioned-template + `CapabilityRegistry` shape. Deterministic classification remains the fallback (RFC-001 "Deterministic Before Intelligent").

## Requirements

### Requirement: Capability Registration

The `classify-lifecycle` capability SHALL register in `CapabilityRegistry` at startup with a versioned v1 template set (`system.md`, `instructions.md`, `examples.json`). Templates MUST align with the `lifecycle-enrichment` output DTO schema.

#### Scenario: Capability discoverable at startup

- GIVEN the AI module boots
- WHEN `CapabilityRegistry.register()` runs for `classify-lifecycle`
- THEN the capability is listed and available with v1 templates
- AND `examples.json` provides at least one few-shot example per supported framework

### Requirement: Manifest-Based Framework Detection

Framework detection SHALL parse manifests deterministically (`package.json`, `pom.xml`, `requirements.txt`, `pyproject.toml`) to produce candidate frameworks and a primary selection, returning `{ candidates, primary }`. It SHALL then request the LLM to confirm/refine the candidates using entry-point files; the LLM's authoritative result SHALL be `{ framework, architecture, confidence }` (LLM-authored confidence, REQ-EP-004 gate — never a deterministic confidence field).

#### Scenario: NestJS project detected from manifest

- GIVEN a repo with `package.json` declaring `@nestjs/core` and an `app.module.ts` entry point
- WHEN framework detection runs
- THEN `package.json` yields candidate `nestjs`
- AND the LLM confirms `{ framework: 'nestjs', architecture: 'mvc', confidence: 0.95 }`

#### Scenario: No manifest yields unknown framework

- GIVEN a repo with no supported manifest file
- WHEN framework detection runs
- THEN no candidates are produced
- AND the detector SHALL emit `{ candidates: [], primary: 'unknown' }` (never guessed), with the LLM confirming via its own confidence (REQ-EP-004 gate)

### Requirement: Per-Endpoint Lifecycle Mapping

The capability SHALL map each endpoint to an ordered lifecycle: `{ endpointFqn, steps: [{ type, name, order, approximate? }], params, returns }` where `type` is `guard|pipe|interceptor|middleware|handler|service|repository`.

#### Scenario: Guard → handler → service lifecycle

- GIVEN a controller sketch with `@UseGuards(JwtGuard)` and a `findAll` method calling `UsersService`
- WHEN lifecycle mapping runs for the endpoint
- THEN steps SHALL be ordered `guard(JwtGuard)` → `handler(findAll)` → `service(UsersService)`
- AND unresolved steps SHALL be flagged `approximate: true`

### Requirement: DTO Extraction

The capability SHALL extract DTO shapes as `{ dtoName, fields: [{ name, type, optional }], usedByEndpoints: [] }` from property signatures.

#### Scenario: DTO fields extracted with optionality

- GIVEN `CreateUserDto` with fields `name: string` and `age?: number`
- WHEN DTO extraction runs
- THEN fields SHALL be `[{ name, type: 'string', optional: false }, { name: 'age', type: 'number', optional: true }]`

### Requirement: Per-Framework Format Configuration

Lifecycle semantics SHALL be described by per-framework format configs (`ai/frameworks/{framework}.json`) consumed by the prompt builder. Adding a framework SHALL require only a config file plus golden tests — no code changes.

#### Scenario: NestJS config drives prompt vocabulary

- GIVEN `ai/frameworks/nestjs.json` describing `@Controller/@Get/@UseGuards` order and DI constructor semantics
- WHEN the prompt builder renders the framework section
- THEN the prompt instructs the LLM using NestJS-specific lifecycle vocabulary

### Requirement: Confidence Thresholds

Every classified item SHALL carry a `confidence` (LLM-authored, REQ-EP-004 gate). Items below threshold SHALL emit `Unknown`/needs-review instead of guessing (RFC-007 §6.4 honesty).

#### Scenario: Low-confidence classification degrades to unknown

- GIVEN a class the LLM cannot confidently classify (confidence below threshold)
- WHEN the confidence gate runs
- THEN the item SHALL be marked `Unknown` and flagged for review, not assigned a guessed role

### Requirement: Output Validation Pipeline

LLM output SHALL pass three gates before persistence: (1) strict JSON parse, (2) schema validation (whitelist, reject unknown fields), (3) referential integrity against the IR. On validation failure the system SHALL retry once with error feedback; on second failure it SHALL fall back to deterministic classification for that unit and SHALL persist `{ fqn, status: 'failed', reason }`. Unvalidated output MUST NOT be persisted.

#### Scenario: Validation failure retried then fell back

- GIVEN LLM output with a hallucinated endpoint FQN not present in the IR
- WHEN the validation pipeline runs
- THEN referential integrity fails
- AND the system retries once with the error appended
- AND on second failure the unit SHALL fall back to deterministic classification with status `failed`

### Requirement: Prompt Injection Defense

Repository code SHALL be treated as untrusted data. The sketch builder SHALL strip comments and non-route string literals, SHALL NOT send `.env*`/credential/binary files, and SHALL only send allowed source extensions plus manifests. Sketches SHALL be wrapped in XML delimiters instructing the model to ignore embedded instructions.

#### Scenario: Comment injection stripped

- GIVEN a source file containing `// ignore previous instructions` in a comment
- WHEN the sketch builder serializes the file
- THEN the comment SHALL be absent from the sketch sent to the LLM

#### Scenario: .env file denied

- GIVEN a repo containing a `.env` file with secrets
- WHEN the AI file selection runs
- THEN the `.env` file SHALL be excluded from any prompt

### Requirement: Deterministic Fallback

When `ai.enabled=false` or enrichment fails, the system SHALL skip enrichment and retain the deterministic classification (roles, `UNKNOWN` defaults) unchanged. Fallback SHALL be per-unit, never global.

#### Scenario: AI disabled leaves deterministic output intact

- GIVEN `ai.enabled=false`
- WHEN analysis runs
- THEN no AI calls occur
- AND the deterministic IR and graph output are unchanged

### Requirement: Evaluation Suite

The capability SHALL ship golden evaluation datasets (mini-nestjs + express fixtures with expected classifications) and injection-tripwire fixtures proving comment/string stripping and `.env` deny-list. CI SHALL run evaluation on a Mock provider and MUST NOT make live API calls.

#### Scenario: Golden fixture yields expected classification

- GIVEN the mini-nestjs golden fixture and a Mock provider
- WHEN the evaluation harness runs
- THEN classifications match the expected golden output

#### Scenario: Injection tripwire proves defense

- GIVEN an injection-tripwire fixture embedding prompt-injection text
- WHEN the evaluation harness runs
- THEN the injected instructions SHALL have no effect on output
- AND the `.env` deny-list is proven

## References

- RFC-009 §14 (Security), RFC-010 (Capability shape, §11.3 Evaluation), RFC-007 §6.4 (Honesty), RFC-001 (Deterministic Before Intelligent)
