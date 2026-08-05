# Intermediate Representation Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)

## Purpose

The Intermediate Representation (IR) is the canonical, language-independent model produced by static analysis and consumed by all downstream capabilities. Per RFC-006 §7–10, the IR is immutable, serializable, and represents architectural concepts rather than language syntax.

## Requirements

### Requirement: IR Domain Model

The IR SHALL model the following concepts as immutable value objects:

| Concept      | Key Fields                   | Relationships                           |
| ------------ | ---------------------------- | --------------------------------------- |
| Project      | name, rootPath, language     | contains Packages                       |
| Package      | name, version                | contains Modules                        |
| Module       | name, path                   | contains Classes, Interfaces, Functions |
| Class        | name, isAbstract, isExported | extends Class, implements Interface     |
| Interface    | name                         | extended by Classes                     |
| Function     | name, isAsync, isExported    | —                                       |
| Method       | name, visibility, isStatic   | belongs to Class                        |
| Endpoint     | httpMethod, path, parameters | belongs to Class                        |
| Dependency   | source, target, type         | connects any two IR nodes               |
| Relationship | kind, from, to               | explicit named relation                 |

Every IR node SHALL have a unique, stable identifier (e.g., `project:package:module:name`).

#### Scenario: TypeScript project produces IR with all concepts

- GIVEN a NestJS project with controllers, services, and DTOs
- WHEN the IR builder processes the parse results
- THEN the IR contains at least one Project, Package, Module, Class, Method, Endpoint, and Dependency

### Requirement: TS AST → IR Builder

The IR builder SHALL consume `ParseResult` objects and produce IR nodes. Builder output MUST be deterministic. Framework-specific constructs (e.g., NestJS decorators) SHALL be mapped to architectural roles, not preserved as raw decorators.

#### Scenario: NestJS controller mapped to IR

- GIVEN a `ParseResult` with a class classified as `controller` role
- WHEN the IR builder processes it
- THEN the resulting IR Class has role `controller`
- AND each `@Get()`, `@Post()` method produces an Endpoint with the correct HTTP method and path

### Requirement: IR Validator

The IR validator SHALL enforce structural, relationship, and referential integrity before the IR can be published. An invalid IR MUST NOT be persisted or published. Validation errors SHALL be collected and reported as a batch.

| Check        | Rule                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| Structural   | Every node has a valid identifier                                             |
| Relationship | Every `source`/`target` references an existing node                           |
| Referential  | Every `extends`/`implements` target exists in the IR                          |
| Required     | Every Project has at least one Package; every Package has at least one Module |

#### Scenario: Valid IR passes all checks

- GIVEN a structurally sound IR
- WHEN the validator runs
- THEN no errors are returned and the IR is cleared for publication

#### Scenario: Dangling reference blocked

- GIVEN an IR where a Dependency references a non-existent target node
- WHEN the validator runs
- THEN a referential integrity error is reported
- AND the IR is rejected for publication

#### Scenario: Batch error collection

- GIVEN an IR with both a missing identifier AND a dangling reference
- WHEN the validator runs
- THEN both errors are reported in a single validation result
- AND publication is blocked

### Requirement: IR Immutability

All IR nodes SHALL be immutable after construction. The IR published as an analysis result MUST NOT be modified. Subsequent analyses SHALL produce a new IR version identified by `snapshotId`.

#### Scenario: Attempted mutation is impossible

- GIVEN a published IR
- WHEN a consumer attempts to modify a node property
- THEN the operation is rejected (type-level or runtime enforcement)

## References

- RFC-006 §7–10 (IR Design), §13 (Immutability), §14 (Validation)
- EPIC-005 §2.5 (Domain Analysis), §2.7 (Metadata Generation)
