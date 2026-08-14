# RFC-011 — Documentation Engine

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Documentation Engine, the bounded context responsible for transforming the Knowledge Graph into comprehensive, always up-to-date technical documentation.

Documentation in DevLens is not manually written. It is generated deterministically from the Knowledge Graph and enriched with AI explanations when appropriate. Every generated artifact is reproducible from the current state of the repository.

The Documentation Engine is one of DevLens' primary deliverables — not an afterthought.

---

# 2. Motivation

Documentation fails for a simple reason: it requires manual maintenance, and manual maintenance inevitably stops.

When documentation and code diverge, developers stop trusting documentation. They return to reading code directly. The documentation investment is wasted.

DevLens solves this by making documentation a _build artifact_ of the analysis pipeline. When the repository changes, documentation regenerates. When a new module is added, its documentation appears automatically. When a dependency changes, the architecture guide updates.

Documentation should never require a developer to "remember to update the docs."

---

# 3. Goals

The Documentation Engine must:

- Generate documentation deterministically from the Knowledge Graph.
- Support multiple documentation types (README, architecture guide, API reference, onboarding guide).
- Export to multiple formats (Markdown, HTML, PDF, OpenAPI, AsyncAPI, Mermaid, PlantUML).
- Optionally enrich documentation with AI-generated explanations.
- Support custom documentation templates.
- Generate documentation on demand and automatically after analysis.
- Maintain a documentation version history tied to repository commits.
- Keep documentation and code synchronized without manual effort.

---

# 4. Non-Goals

This RFC does **not** define:

- How the Knowledge Graph is built (see RFC-007).
- How AI generates explanatory text (see RFC-009, RFC-010).
- How visualizations are rendered (see RFC-008).
- A WYSIWYG documentation editor.
- Collaborative editing features.

---

# 5. Architecture

## 5.1 Pipeline

```text
Knowledge Graph (RFC-007)
        │
        ▼
Document Template Selector
  - Identify applicable templates
  - Match template to graph structure
        │
        ▼
Content Generator
  - Extract structured data from graph
  - Apply template sections
  - Generate deterministic content
        │
        ▼
AI Enricher (optional)
  - Generate explanations for sections
  - Summarize modules and services
  - Add contextual narrative
        │
        ▼
Format Renderer
  - Render to target format
  - Apply styling and layout
        │
        ▼
Documentation Artifact
  - Versioned output
  - Stored for retrieval and export
```

## 5.2 Separation of Concerns

- **Template**: defines _what_ to document (sections, structure).
- **Content Generator**: extracts _what exists_ (deterministic data from the graph).
- **AI Enricher**: adds _why it matters_ (explanatory narrative).
- **Format Renderer**: produces _how it looks_ (Markdown, HTML, PDF, etc.).

Each layer can be modified independently. A template change does not require modifying the renderer.

---

# 6. Documentation Types

## 6.1 Project README

Generated for the repository root:

- Project overview (from Knowledge Graph metadata).
- Architecture diagram (Mermaid, rendered from graph structure).
- Module index (list of all modules with descriptions).
- Technology stack (detected from package manifests).
- Getting started guide (generated from project structure).
- Links to detailed documentation.

## 6.2 Architecture Guide

Comprehensive architecture documentation:

- System overview with C4 Context diagram.
- Container diagram (services, databases, message brokers).
- Component diagram (modules within each service).
- Bounded context map with domain descriptions.
- Event catalog (all domain events, producers, consumers).
- Dependency map with coupling analysis.
- External service integrations.

## 6.3 API Reference

Per-module or per-controller API documentation:

- Endpoint list with HTTP methods, paths, and descriptions.
- Request/response schemas (inferred from DTOs).
- Authentication requirements.
- Error responses.
- Example requests (generated from types).
- OpenAPI 3.0 specification export.

## 6.4 Module Documentation

Per-module detailed documentation:

- Module purpose and responsibility.
- Public API surface (exports, services, controllers).
- Dependencies (what it uses and what uses it).
- Domain model (entities, value objects, aggregates).
- Events published and consumed.
- Database tables accessed.
- AI-generated module summary.

## 6.5 Onboarding Guide

Generated for new developers:

- Repository structure walkthrough.
- Key modules and their roles.
- Architecture overview (simplified).
- Development setup instructions.
- Common workflows (how to add an endpoint, how to add a service).
- Glossary of domain terms.

## 6.6 ADR Index (Architecture Decision Records)

- Index of all detected ADRs in the repository.
- Timeline visualization of architectural decisions.
- Links between ADRs and the modules they affect.

---

# 7. Template System

## 7.1 Template Structure

Templates define documentation structure declaratively:

```yaml
id: module-documentation
name: Module Documentation
version: 1
sections:
  - id: overview
    title: Overview
    source: ai.enrich(module.summary)
  - id: public-api
    title: Public API
    source: graph.exports(module.id)
    format: table
  - id: dependencies
    title: Dependencies
    source: graph.dependencies(module.id, depth: 1)
    format: list
  - id: domain-model
    title: Domain Model
    source: graph.entities(module.id)
    format: mermaid-class-diagram
  - id: events
    title: Events
    source: graph.events(module.id)
    format: table
    condition: has_events
```

## 7.2 Custom Templates

Organizations can define custom templates:

- Template files stored per organization/workspace.
- Templates inherit from built-in templates.
- Sections can be added, removed, or reordered.
- Custom branding (logos, colors, headers) applied to exports.

## 7.3 Template Resolution

For a given module, the engine:

1. Checks for organization-level custom templates.
2. Falls back to built-in templates.
3. Merges multiple applicable templates (e.g., module template + API reference template for a controller).

---

# 8. AI Enrichment

## 8.1 When AI Is Used

AI enriches documentation — it does not create it from scratch. The structural content is always deterministic.

AI is used for:

- Module summaries and purpose descriptions.
- Architectural narrative (connecting the dots between components).
- Contextual explanations of complex relationships.
- Plain-language descriptions of technical concepts.

## 8.2 AI vs. Deterministic Content

| Content                     | Source        |
| --------------------------- | ------------- |
| Module name, file path      | Deterministic |
| Dependencies list           | Deterministic |
| Endpoint paths, methods     | Deterministic |
| Event names, types          | Deterministic |
| Module purpose summary      | AI            |
| Architecture narrative      | AI            |
| Domain concept explanations | AI            |
| Onboarding narrative        | AI            |

AI content is clearly marked with a "Generated by AI" indicator. Users can regenerate any AI-enriched section.

## 8.3 Enrichment Control

- AI enrichment is optional — documentation can be generated with deterministic content only.
- Per-section control: users can enable/disable AI for specific sections.
- AI tier gating: enrichment capabilities follow the tier model (Free = basic summaries, Professional = detailed explanations).

---

# 9. Export Formats

## 9.1 Format Renderers

| Format       | Renderer               | Use Case                                   |
| ------------ | ---------------------- | ------------------------------------------ |
| Markdown     | Template-based         | Repo README, wiki, static sites            |
| HTML         | Template + CSS         | Web-based documentation portal             |
| PDF          | HTML → PDF (Puppeteer) | Offline documentation, client deliverables |
| OpenAPI 3.0  | JSON/YAML generator    | API documentation for tools like Swagger   |
| AsyncAPI 2.x | JSON/YAML generator    | Event-driven API documentation             |
| Mermaid      | Text generator         | Embeddable diagrams in Markdown            |
| PlantUML     | Text generator         | UML diagrams for enterprise tools          |
| JSON         | Graph serialization    | Machine-readable documentation             |

## 9.2 Export Triggers

Documentation can be generated:

- **On-demand**: user clicks "Generate Documentation" for a module or project.
- **Post-analysis**: automatically after a new analysis snapshot is processed.
- **Scheduled**: periodic regeneration (e.g., nightly for large repositories).
- **Webhook**: triggered by external systems via API.

---

# 10. Versioning

Every generated documentation artifact is versioned:

- Tied to the repository commit SHA at the time of generation.
- Stored with metadata (generation timestamp, template version, AI model version).
- Historical versions are retained for comparison.

This enables:

- "What changed in the docs?" between commits.
- Audit trail of documentation evolution.
- Rollback to documentation for a specific commit.

---

# 11. Storage

Generated documentation artifacts are stored in object storage (S3-compatible):

- `/{organization_id}/{repository_id}/{commit_sha}/{document_type}.{format}`
- Latest version also stored at `/{organization_id}/{repository_id}/latest/` for fast retrieval.

Metadata (document index, version history) is stored in PostgreSQL.

---

# 12. Performance

Documentation generation is a background operation:

- Triggered by `KnowledgeGraphBuilt` or `KnowledgeGraphUpdated` events.
- Executed via BullMQ jobs.
- Generation progress is reported to the frontend.
- Users receive a notification when documentation is ready.

Target generation times:

| Repository Size          | Target       |
| ------------------------ | ------------ |
| Small (< 100 modules)    | < 30 seconds |
| Medium (100-500 modules) | < 2 minutes  |
| Large (500+ modules)     | < 5 minutes  |

AI enrichment is the dominant cost factor. Generation without AI is near-instantaneous.

---

# 13. Integration Points

- **Knowledge Graph (RFC-007)**: primary data source.
- **AI Orchestration (RFC-009)**: AI enrichment for summaries and narratives.
- **Visualization Engine (RFC-008)**: embedded diagrams via Mermaid/PlantUML.
- **Search (RFC-012)**: documentation is indexed for full-text search.

---

# 14. Future Considerations

- **Interactive documentation**: HTML exports with embedded interactive graph views.
- **Diff documentation**: generate documentation showing only what changed between commits.
- **Multi-language documentation**: translate generated docs to multiple languages.
- **Documentation linting**: flag missing or incomplete documentation sections.
- **CI/CD integration**: generate documentation as part of CI pipelines.
- **Documentation site hosting**: built-in static site hosting for generated HTML docs.

---

# 15. References

- RFC-001 — Architecture Principles (Documentation as a First-Class Citizen)
- RFC-007 — Knowledge Extraction Platform
- RFC-009 — AI Orchestration
- EPIC-009 — Documentation Engine
- PRODUCT_CONTEXT.md — Section 5, Principle 4 (Documentation Is Generated)
