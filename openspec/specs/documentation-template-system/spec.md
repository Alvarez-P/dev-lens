# documentation-template-system Specification

## Purpose

Define the YAML-based template system for documentation generation. Templates declaratively specify what sections to produce, what data sources to extract from, what format to render in, and what conditions control section inclusion. Templates are versioned, loaded from the filesystem, and resolved via a built-in → organization custom fallback chain. Per RFC-011 §7.

## Requirements

| #   | Requirement                   | Strength |
| --- | ----------------------------- | -------- |
| R1  | Template YAML structure       | MUST     |
| R2  | Source types                  | MUST     |
| R3  | Format types                  | MUST     |
| R4  | Conditional sections          | MUST     |
| R5  | Template resolution hierarchy | MUST     |
| R6  | Filesystem loading            | MUST     |
| R7  | Built-in v1 templates         | MUST     |

### Requirement: Template YAML Structure

Every template file SHALL have the following top-level fields: `id` (string, unique identifier), `name` (string, human-readable), `version` (integer), and `sections` (array of section objects). Each section object SHALL contain `id` (string, unique within template), `title` (string, display title), `source` (string, function call expression), and `format` (string, renderer format name). Sections MAY optionally contain `condition` (string, conditional expression).

#### Scenario: Valid template loads successfully

- GIVEN a template file with all required fields and valid section entries
- WHEN the template loader reads the file
- THEN the template is parsed into a `DocTemplate` entity
- AND all sections are available for generation

#### Scenario: Invalid template returns parse error

- GIVEN a template file missing the required `version` field
- WHEN the template loader attempts to parse it
- THEN a parse error is thrown
- AND the error message identifies the missing field and template path

### Requirement: Source Types

The template system SHALL support the following source function expressions in section `source` fields:

| Source Expression                        | Returns                          |
| ---------------------------------------- | -------------------------------- |
| `graph.exports(moduleId)`                | Public API surface of a module   |
| `graph.dependencies(moduleId, depth: N)` | Dependency tree to depth N       |
| `graph.entities(moduleId)`               | Domain entities in a module      |
| `graph.endpoints(moduleId)`              | HTTP endpoints in a controller   |
| `graph.events(moduleId)`                 | Domain events in a module        |
| `ai.enrich(sectionId)`                   | AI-generated explanatory content |

`graph.exports()` SHALL accept an optional `moduleId` parameter; when omitted, exports for all modules SHALL be returned. `graph.dependencies()` SHALL accept a `depth` parameter defaulting to 1.

#### Scenario: graph.exports with specific module

- GIVEN a template section with `source: graph.exports("my-module")`
- WHEN the content extractor evaluates the source expression
- THEN only the exports of `my-module` are returned

#### Scenario: graph.dependencies with depth 2

- GIVEN a template section with `source: graph.dependencies("my-module", depth: 2)`
- WHEN the content extractor evaluates the source expression
- THEN direct and transitive dependencies up to 2 levels deep are returned

#### Scenario: ai.enrich triggers AI provider call

- GIVEN a template section with `source: ai.enrich("overview")`
- WHEN the AI enrichment stage processes this section
- THEN the AI capability framework is invoked with the section's extracted content as context
- AND the result is flagged as AI-generated

### Requirement: Format Types

The template system SHALL map section `format` values to renderer names:

| Format Value            | Renderer              |
| ----------------------- | --------------------- |
| `table`                 | Markdown table        |
| `list`                  | Markdown list         |
| `mermaid-class-diagram` | Mermaid class diagram |
| `mermaid-flowchart`     | Mermaid flowchart     |
| `plantuml`              | PlantUML diagram      |
| `markdown`              | Raw Markdown          |
| `json`                  | JSONEncoder           |

Unrecognized format values SHALL cause the section to be skipped with a warning logged.

#### Scenario: Section renders as Mermaid class diagram

- GIVEN a section with `format: mermaid-class-diagram` and `source: graph.entities("my-module")`
- WHEN the format renderer processes the section
- THEN the MermaidRenderer is invoked
- AND valid Mermaid class diagram text is produced

#### Scenario: Unrecognized format skips with warning

- GIVEN a section with `format: unknown-format`
- WHEN the pipeline processes the section
- THEN the section is skipped
- AND a warning is logged with the template ID and section ID

### Requirement: Conditional Sections

The template system SHALL support the following condition expressions on sections: `has_events` (include if module has domain events), `has_endpoints` (include if controller has HTTP endpoints), `has_dependencies` (include if module has dependencies), `is_controller` (include if module type is Controller), `is_service` (include if module type is Service). Sections with conditions that evaluate to false SHALL be excluded from the generated output.

#### Scenario: Events section excluded for module without events

- GIVEN a module with zero domain events
- AND a template section with `condition: has_events` and `source: graph.events(moduleId)`
- WHEN the pipeline evaluates conditions
- THEN the section is excluded from the output
- AND no empty events table is rendered

#### Scenario: Endpoints section included for controller

- GIVEN a module of type Controller with 5 HTTP endpoints
- AND a template section with `condition: has_endpoints`
- WHEN the pipeline evaluates conditions
- THEN the section is included in the output
- AND the endpoint data is rendered in the specified format

### Requirement: Template Resolution Hierarchy

Template resolution SHALL follow this order: (1) check for an organization-level custom template for the given type, (2) fall back to the built-in template for that type, (3) merge multiple applicable templates for a single module (e.g., module-docs + api-reference for a controller). Organization custom templates SHALL be deferred to Phase 2; Phase 1 SHALL use only built-in templates.

#### Scenario: Built-in template used when no custom exists

- GIVEN no organization-level custom template for `readme`
- WHEN the template resolver looks up `readme`
- THEN the built-in `readme` template is returned

#### Scenario: Multiple templates merged for controller module

- GIVEN a module of type Controller
- WHEN template resolution runs
- THEN the `module-docs` and `api-reference` templates are both selected
- AND their sections are merged into a single documentation artifact

### Requirement: Filesystem Loading

Templates SHALL be loaded from `src/modules/documentation/templates/{type}/v{n}/template.yml` at module initialization. The loader SHALL scan all template directories and register them in a `DocTemplateRegistry` keyed by `(type, version)`. Loading errors SHALL cause module initialization to fail — no silent fallback.

#### Scenario: All built-in templates load at startup

- GIVEN the documentation module initializes
- WHEN the template loader scans `src/modules/documentation/templates/`
- THEN all built-in v1 templates are parsed and registered
- AND the `DocTemplateRegistry` contains entries for all 5 built-in types

#### Scenario: Corrupt template file fails initialization

- GIVEN a template file with invalid YAML syntax
- WHEN the documentation module initializes
- THEN module initialization fails with a descriptive error
- AND the error message includes the file path

### Requirement: Built-in v1 Templates

Phase 1 SHALL ship with five built-in templates at version 1: `readme` (project overview, architecture diagram, module index, tech stack, getting started), `architecture-guide` (system overview, container diagram, component diagram, bounded context map, event catalog, dependency map), `api-reference` (endpoint list, request/response schemas, auth requirements, error responses, OpenAPI export), `module-docs` (module purpose, public API, dependencies, domain model, events, DB tables), `onboarding-guide` (repo structure, key modules, architecture overview, dev setup, common workflows, glossary).

#### Scenario: README template includes all required sections

- GIVEN the built-in `readme` template v1
- WHEN the template is loaded
- THEN it contains sections for project overview, architecture diagram, module index, technology stack, and getting started
- AND each section has a valid source expression and format

#### Scenario: Architecture guide template includes event catalog

- GIVEN the built-in `architecture-guide` template v1
- WHEN applied to a repository with domain events
- THEN the event catalog section is included (condition: `has_events` evaluates true)
- AND events are rendered in a table format

## References

- RFC-011 §7 (Template System), §7.1 (Template Structure), §7.3 (Template Resolution)
- EPIC-009 §Documentation Templates
