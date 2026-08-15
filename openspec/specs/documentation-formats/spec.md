# documentation-formats Specification

## Purpose

Define the format renderer registry and individual renderers that transform structured documentation content into output formats. New renderers SHALL require zero changes to existing code via a token-map registry pattern. Per RFC-011 §9.

## Requirements

| #   | Requirement                | Strength |
| --- | -------------------------- | -------- |
| R1  | RendererRegistry token-map | MUST     |
| R2  | MarkdownRenderer           | MUST     |
| R3  | HTMLRenderer               | MUST     |
| R4  | OpenAPI3Renderer           | MUST     |
| R5  | MermaidRenderer            | MUST     |
| R6  | PlantUMLRenderer           | MUST     |
| R7  | JSONRenderer               | MUST     |

### Requirement: RendererRegistry Token-Map

The format renderer system SHALL use a token-map registry pattern identical to `AI_PROVIDER_REGISTRY`. Each renderer SHALL be registered via NestJS custom provider with an injection token (e.g., `FORMAT_RENDERER`). The registry SHALL resolve renderers by format name (string key). Adding a new renderer SHALL require only: (1) implement the `IDocFormatRenderer` interface, (2) register it with the registry token. Existing renderers and the registry itself SHALL require zero changes.

#### Scenario: New renderer added without touching existing code

- GIVEN a new `PDFRenderer` implementing `IDocFormatRenderer`
- WHEN it is registered with the `FORMAT_RENDERER` injection token via a factory provider that injects the individual renderer instances and returns them as an array (NestJS has no `multi: true`)
- THEN the registry resolves it by its format key
- AND no existing renderers or registry code are modified

#### Scenario: Renderer resolved by format key

- GIVEN the renderer registry with registered `MarkdownRenderer` for key `markdown`
- WHEN the pipeline requests a renderer for format `markdown`
- THEN the `MarkdownRenderer` instance is returned

### Requirement: MarkdownRenderer

The MarkdownRenderer SHALL transform template sections into GitHub-flavored Markdown. Sections with `format: table` SHALL be rendered as GFM tables. Sections with `format: list` SHALL be rendered as bulleted lists. Sections with `format: mermaid-class-diagram` or `format: mermaid-flowchart` SHALL be rendered as fenced code blocks with language `mermaid`. Sections with `format: plantuml` SHALL be rendered as fenced code blocks with language `plantuml`. Sections with `format: markdown` SHALL pass through raw. A section title SHALL be rendered as a `##` heading.

#### Scenario: Table section renders as GFM table

- GIVEN a section with `format: table` containing endpoint data
- WHEN the MarkdownRenderer processes it
- THEN a GFM-compliant table is produced with the section title as a `##` heading
- AND column headers match the data keys

#### Scenario: Mermaid diagram renders as fenced code block

- GIVEN a section with `format: mermaid-class-diagram` containing entity data
- WHEN the MarkdownRenderer processes it
- THEN the output includes ` ```mermaid` and ` ``` ` fences
- AND the content between fences is valid Mermaid syntax

### Requirement: HTMLRenderer

The HTMLRenderer SHALL accept Markdown output and convert it to HTML. It SHALL wrap the converted HTML in a styled HTML document with a `<head>` containing meta tags, title, and default CSS. The conversion SHALL use a Markdown-to-HTML library (e.g., `marked` or `remark`). The resulting HTML SHALL be self-contained for download.

#### Scenario: Markdown converted to HTML standalone page

- GIVEN a complete Markdown documentation artifact
- WHEN the HTMLRenderer processes it
- THEN the output is a valid HTML5 document
- AND the `<head>` includes meta charset, viewport, and title
- AND all Markdown structures (headings, tables, code blocks, lists) are converted to HTML

#### Scenario: Mermaid code blocks preserved for client-side rendering

- GIVEN Markdown containing a ` ```mermaid` fenced code block
- WHEN the HTMLRenderer processes it
- THEN the Mermaid code is preserved as a `<pre><code class="language-mermaid">` block
- AND the HTML includes a Mermaid client-side renderer script reference

### Requirement: OpenAPI3Renderer

The OpenAPI3Renderer SHALL accept endpoint and DTO data and produce a valid OpenAPI 3.0 JSON document. The output SHALL include `openapi: "3.0.0"`, `info` (title, version), `paths` (endpoints with HTTP methods, parameters, request bodies, responses), and `components.schemas` (DTO schemas). When DTO field metadata is absent, the renderer SHALL degrade gracefully by producing schemas with `type: object` and no properties rather than failing.

#### Scenario: Full OpenAPI 3.0 document generated

- GIVEN a controller module with 5 endpoints and complete DTO field metadata
- WHEN the OpenAPI3Renderer processes the data
- THEN the output is valid OpenAPI 3.0 JSON
- AND `paths` contains all 5 endpoint entries
- AND `components.schemas` contains all DTO definitions with properties

#### Scenario: Graceful degradation with absent DTO fields

- GIVEN endpoint data where DTO schemas have no field-level metadata
- WHEN the OpenAPI3Renderer processes the data
- THEN the output is still valid OpenAPI 3.0 JSON
- AND affected schemas have `type: object` with empty `properties`
- AND no error is thrown

### Requirement: MermaidRenderer

The MermaidRenderer SHALL accept a subgraph of the knowledge graph and produce valid Mermaid diagram text. For `mermaid-class-diagram`, entities SHALL be rendered as classes with fields (attributes) and methods. For `mermaid-flowchart`, nodes and edges SHALL be rendered with directional arrows and labels. The output SHALL be syntactically valid Mermaid text, not an image.

#### Scenario: Class diagram from entity data

- GIVEN a set of domain entities with fields and methods
- WHEN the MermaidRenderer processes them with format `mermaid-class-diagram`
- THEN the output begins with `classDiagram`
- AND each entity is a Mermaid class with attributes and methods
- AND inheritance/composition relationships are rendered as arrows

#### Scenario: Flowchart from dependency data

- GIVEN a set of modules with dependency edges
- WHEN the MermaidRenderer processes them with format `mermaid-flowchart`
- THEN the output is valid Mermaid flowchart text
- AND each module is a node
- AND each dependency is a directed edge with a label

### Requirement: PlantUMLRenderer

The PlantUMLRenderer SHALL accept a subgraph of the knowledge graph and produce valid PlantUML text. The output SHALL begin with `@startuml` and end with `@enduml`. Entity relationships SHALL be rendered using PlantUML relationship syntax.

#### Scenario: PlantUML diagram from entity data

- GIVEN a set of domain entities with relationships
- WHEN the PlantUMLRenderer processes them
- THEN the output begins with `@startuml` and ends with `@enduml`
- AND entities are rendered as PlantUML classes or components
- AND relationships use appropriate PlantUML arrow syntax

### Requirement: JSONRenderer

The JSONRenderer SHALL accept the full structured documentation data (all sections, all extracted content) and produce a single JSON document. The output SHALL be machine-readable and include all section data, metadata, and relationships unchanged. This renderer SHALL apply no formatting transformations beyond JSON serialization.

#### Scenario: Full structured dump as JSON

- GIVEN documentation content with 5 sections containing structured data
- WHEN the JSONRenderer processes it
- THEN the output is a valid JSON document
- AND all section data is present with its original structure
- AND metadata fields (docType, timestamp, commitSha) are included

## References

- RFC-011 §9 (Export Formats), §9.1 (Format Renderers)
- EPIC-009 §Export System
