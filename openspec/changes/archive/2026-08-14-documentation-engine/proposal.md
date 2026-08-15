# Proposal: Documentation Engine (EPIC-009 / RFC-011)

## Intent

Docs must never drift from code (ROADMAP M6). The graph holds all structural knowledge but nothing consumes it for docs; MinIO sits unused. Adds the `documentation` bounded context: event-triggered, versioned, multi-format docs, optionally AI-enriched.

## Scope

### In Scope

- Doc types: README, Architecture Guide, API Reference, Module Docs
- Formats: Markdown, HTML, OpenAPI 3.0, Mermaid, PlantUML, JSON
- YAML template system (versioned; mirrors capability framework)
- Event-triggered (BullMQ queue) + on-demand generation
- Per-section AI enrichment, flagged AI
- MinIO (RFC-011 §11 keys) + Postgres artifact metadata
- API: list, get, download (presigned), regenerate, history
- Frontend: `[id]/docs` list + viewer + sidebar nav

### Out of Scope

- PDF; AsyncAPI + event docs (parser captures no events)
- Custom templates, scheduled/diff regeneration, wiki editing

## Capabilities

### New Capabilities

- `documentation-generation`: handler → BullMQ job → pipeline (graph → templates → content → optional AI → render → store); `generated/failed` events
- `documentation-template-system`: versioned YAML templates (`templates/{id}/v{n}/template.yaml`), loader + registry, section model
- `documentation-formats`: renderer token-map registry (like `AI_PROVIDER_REGISTRY`); Markdown, HTML, OpenAPI, Mermaid, PlantUML, JSON
- `documentation-storage`: MinIO module (bucket ensure, put/get/presign), RFC-011 §11 keys, Postgres metadata + history
- `documentation-api`: REST list/get/download/regenerate/history; JWT + RepoMembership guard
- `documentation-views`: frontend list, viewer, download, sidebar entry

### Modified Capabilities

- None — consumes `knowledge-graph-query-api`/`ai-capability-framework` unchanged (handler-only, pattern proven by `ai-observability`).

## Approach

New `src/backend/src/modules/documentation/` context following the knowledge-graph event→queue→worker recipe. Data: exported `GraphQueryService.findAllNodesAndEdges` (AI facts merged into node props). `DocTemplateRegistry` mirrors `CapabilityRegistryService`; renderers plug into a token-map registry. Batch AI in-job; idempotent regeneration per commit SHA.

## Affected Areas

- New: `modules/documentation/` (domain/application/infrastructure + templates)
- Modified: `modules/app.module.ts`; backend + frontend `package.json`
- New: frontend `[id]/docs/` + `components/documentation/`; markdown renderer dep

## Risks

- OpenAPI schema depth depends on AI `dtoFields` — Med; graceful missing-schema handling
- First real MinIO usage — Med; MinioService unit/integration tests
- AI cost dominates — Med; per-section enablement + per-analysis caching
- No template engine in deps — Med; purpose-built section renderer

## Rollback Plan

Flag-gate the event handler (off = no auto-generation). Additive registration/routes — removal reverts cleanly. Versioned templates: point registry at prior `v{n}`.

## Dependencies

- `KnowledgeGraphModule` (`GraphQueryService`) · `AiModule` capability framework
- MinIO (provisioned) · BullMQ (queues, DLQ, WorkerHost)
- New deps: `yaml` (backend), markdown renderer (frontend)

## Success Criteria

- [ ] Docs auto-generate after `knowledge-graph.built`
- [ ] All 6 formats render + download; OpenAPI 3.0 validates
- [ ] Regeneration idempotent per commit SHA
- [ ] Deterministic sections AI-free; AI sections flagged
- [ ] New template/renderer with zero edits to existing code
- [ ] Small repo generation < 30s (RFC-011 §12)
