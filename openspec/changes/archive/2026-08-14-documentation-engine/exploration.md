# Exploration: Documentation Engine (EPIC-009 / RFC-011)

> Phase: sdd-explore | Date: 2026-08-11 | Mode: openspec
> Change folder: `openspec/changes/documentation-engine/`
> User motivation: EPIC-009 — transform the Knowledge Graph into always up-to-date
> technical documentation (README, architecture guide, API reference, module docs,
> onboarding guide) in multiple export formats (Markdown, HTML, PDF, OpenAPI, Mermaid,
> PlantUML), triggered after analysis completes, with optional AI enrichment.

---

## 1. Knowledge Graph API — Data Available for Docs

### 1.1 Query surface (exists, rich)

`GraphQueryService` (exported by `KnowledgeGraphModule`) + `GraphController` under
`/api/v1/graph` (JWT + `RepoMembershipGuard`):

| Capability                               | Where                               | Doc-engine use                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `findAllNodesAndEdges(repoId, version?)` | GraphQueryService / GraphRepository | **PRIMARY data source** — one call returns all non-deprecated nodes + edges of the latest version                                                                           |
| `GET /graph/:repoId/export`              | Controller                          | Same, over HTTP (used by frontend tooling)                                                                                                                                  |
| `getLatestGraphSnapshot(repoId)`         | Service                             | Snapshot summary: version, node/edge counts, **commitSha**, status, createdAt — needed for doc versioning metadata                                                          |
| `getNodes(repoId, {type})`               | Service                             | Filtered lists (e.g. all `Controller` nodes)                                                                                                                                |
| `getNodeWithEdges(repoId, fqn)`          | Service                             | Per-node neighborhood (module docs: what it depends on / what depends on it)                                                                                                |
| `getEndpointFlow(repoId, fqn)`           | Service                             | **Ordered request flow** for an endpoint: guards → pipes → interceptors → handler → services → repositories, incl. DTO payload type (via `DEPENDS_ON` parameter-type edges) |
| Static helpers                           | Service                             | `getNodesByType`, `getNodeByFqn`, `getNeighborhood`, `getEdges` — pure functions over an in-memory node/edge array                                                          |

### 1.2 Node types (`node-type.enum.ts`)

`Project, Package, Module, Controller, Service, Repository, Entity, DTO, Interface,
Endpoint, ExternalDependency, Guard, Pipe, Interceptor, Middleware`

### 1.3 Edge types (`edge-type.enum.ts`)

`BELONGS_TO, IMPLEMENTS, EXTENDS, IMPORTS, DEPENDS_ON, EXPOSES, PROTECTS, TRANSFORMS,
INVOKES, INJECTS`

### 1.4 Node properties carried per type (from `semantic-model.builder.ts`)

| Node type                                | Properties                                                        | Doc-engine use                   |
| ---------------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| `PROJECT`                                | `language`, `rootPath`, `framework`, `architecture` (AI-enriched) | README overview, tech stack      |
| `PACKAGE`                                | `version`                                                         | Dependency docs                  |
| `MODULE`                                 | `filePath`                                                        | Module docs, README module index |
| `CLASS` (Controller/Service/Repo/Entity) | `isAbstract`, `isExported`, `role` (AI), `dtoFields` (AI)         | API ref, module docs             |
| `ENDPOINT`                               | `httpMethod`, `path`                                              | API Reference (core!)            |
| Guard/Pipe/Interceptor/Middleware        | `lifecycleKind`, `order`                                          | Request flow docs                |
| `INTERFACE`                              | `isExported`                                                      | Technical reference              |
| `FUNCTION`                               | `isAsync`, `isExported`                                           | Technical reference              |

All nodes carry `fqn`, `label`, `sourceFile`, `repoId`, `version`, `deprecatedAt`.

### 1.5 What is NOT in the graph (gaps)

- **No domain events.** No event nodes/edges anywhere; `IrProject` has no events field.
  EPIC/RFC list "Event Documentation", "Event catalog", and **AsyncAPI** export — all
  **blocked on data that the parser never captures**. The Architecture Guide's event
  catalog and the AsyncAPI exporter must be scoped out or depend on a future parser
  change (out of scope here).
- **No container/infra layer.** C4 context/container diagrams can't be derived fully;
  component-level Mermaid diagrams from the graph are feasible.
- **DTO field schemas are AI-dependent.** Deterministic DTO nodes have no field list;
  `dtoFields` exists only when AI enrichment ran. OpenAPI request/response schema
  completeness varies with enrichment.
- **No aggregation service** grouping nodes per module/controller — the doc engine must
  build these projections (trivial over `findAllNodesAndEdges`, using existing static helpers).

---

## 2. Existing Documentation Artifacts

**None in application code.** Verified: no `doc`, `documentation`, `export`, or
`template` module under `src/backend/src/modules/`. The only doc-adjacent artifacts:

- **`explain-module` AI capability** — `src/backend/src/modules/ai/ai/capabilities/explain-module/v1/{system.md,output-format.md}`,
  registered in `ai.module.ts` `onModuleInit`. On-demand, SSE-streamed module
  explanation via the capability framework (context strategy targets `MODULE` nodes,
  relationship depth 1, includeDependents/Dependencies/ApiSurface, output `markdown`).
  **This is a working proof that graph-context AI explanation already exists.**
- Root `docs/` holds project RFCs/epics — not generated documentation.

---

## 3. AI Enrichment Integration

Two distinct pipelines exist (both reuseable):

### 3.1 Batch pipeline (`EnrichmentService` — 7 stages)

`analysis.completed` → BullMQ `ai-enrichment` → assemble KG+IR context → prompt
(`classify-lifecycle` capability, versioned templates) → provider call
(openai/ollama/mock/deepseek via `ProviderSelectorService`) → `ThreeGatesValidator`
(schema retry once, referential drop, confidence gate) → persist immutable
`IrEnrichment` → dispatch `enrichment.completed` → **KG rebuild merges enrichment into
node properties** (`role`, `dtoFields`, `framework`, `architecture`).

**Implication:** by the time the graph is built, AI-enriched facts are ALREADY part of
the graph node properties. The doc engine can consume them deterministically with zero
extra AI calls. This satisfies RFC-011 §8.2 (AI marks explanatory content; structural
facts stay deterministic).

### 3.2 On-demand streaming pipeline (`AIService.enrich`)

`capabilityId + repoId + nodeId` → `Observable<AIChunk>` → SSE `GET /ai/stream`.
Capability framework: versioned prompt templates (`system.md`, `instructions.md`,
`examples.json`), `ContextStrategy` (targetNodeType, relationshipDepth,
includeDependents/Dependencies/ApiSurface/EventSurface/DomainContext), `OutputFormat`
(text/markdown/json/mermaid), provider routing, token budgets, observer events.

**Implication:** doc enrichment (module summaries, architecture narrative, onboarding
prose) fits this capability model directly. Register doc-specific capabilities (e.g.
`summarize-module` → markdown, `architecture-narrative`) that run per-section with the
deterministic section content as context. `explain-module` already exists as a v1
foundation. Per-section AI control (RFC §8.3) maps to per-capability enablement.

**Decision point for design:** batch (persist enriched sections into the doc artifact
during generation, run in the BullMQ job) vs streaming (on-demand regeneration of an
AI section in the UI). Recommend batch-with-caching for v1 (deterministic artifacts,
idempotent regeneration), plus per-section cache keyed by `analysisId + section id`.

---

## 4. Storage — MinIO

### 4.1 State: provisioned but UNUSED

- `docker-compose.yml` runs `devlens-minio` (healthy gate for backend).
- `MinioConfig` in `config/configuration.ts` + `ConfigService.get minio` (endpoint,
  port, accessKey, secretKey, **bucket**).
- `minio@8.0.3` is a backend dependency.
- `.env.example` has `MINIO_*` vars.
- `HealthController` pings it via `new Minio.Client(...)`.
- **Zero bucket operations anywhere.** No MinIO module, no object storage pattern.
  Repos are the only file storage, on local disk (`REPO_STORAGE_PATH` + `simple-git`).

### 4.2 Required by RFC-011 §11

- Object key: `/{organization_id}/{repository_id}/{commit_sha}/{document_type}.{format}`
  plus `/{organization_id}/{repository_id}/latest/`.
- Metadata (document index, version history) in PostgreSQL.
- `RepositoryEntity` already carries `organizationId` + `workspaceId` → path derivable.

**Missing:** a shared MinIO module (client provider, ensure-bucket on boot, put/get/
presigned URL) — this will be the codebase's **first real object-storage usage**.

---

## 5. Frontend

- **No doc routes or viewers.** Existing repo routes: `[id]/` (detail), `[id]/api`
  (API endpoints), `[id]/graph` (graph viz), `[id]/sync`. Sidebar is a generic
  `SidebarItem[]` driven component (`app-shell.tsx`) — adding a "Documentation" link is
  trivial.
- **`ApiEndpointsView`** (`components/api-endpoints/`) already renders endpoint list +
  expandable request flow (fetches `/graph/:repoId/endpoints/:fqn/flow`) — directly
  reusable inside an API Reference doc view.
- **No markdown renderer** (`react-markdown`/remark absent), no HTML/PDF viewer, no YAML
  lib in frontend deps. Must add a markdown renderer for doc viewing.
- Patterns to follow: TanStack Query via `lib/api-client` (`get`, `isSuccessResponse`),
  `PageHeader`/`Button`/`Badge`/`LoadingState` molecules, `useToast`.

---

## 6. Template System

- **AI prompt templates**: `PromptTemplateLoader` loads versioned markdown dirs
  `ai.capabilities/{capability-id}/v{n}/{system.md,instructions.md,examples.json}`;
  `CapabilityRegistryService` registers/lists/gets capabilities; `CapabilityPromptBuilder`
  substitutes `{{var}}` placeholders with budget checks.
- **Doc templates (RFC-011 §7, YAML) do NOT exist.** No YAML parser in backend deps
  (`yaml`/`js-yaml` missing from both package.json files).

**Recommendation:** mirror the proven pattern 1:1 — a `DocTemplateLoader` reading
versioned YAML template dirs (`documentation/templates/{id}/v{n}/template.yaml`) plus a
`DocTemplateRegistry` modeled on `CapabilityRegistryService`. The YAML schema from
RFC-011 §7.1 (`id/name/version/sections[{id,title,source,format,condition}]`) maps
`sections[].source` to deterministic content-generator functions (e.g.
`graph.exports(module.id)` → `ModuleContentGenerator`), and `sections[].format` to
renderer fragments (table/list/mermaid-class-diagram). Custom org templates (§7.2) can
later layer on the same registry with workspace-scoped base paths.

---

## 7. Event System

- **`GraphBuiltEvent` (`knowledge-graph.built`) and `GraphUpdatedEvent`
  (`knowledge-graph.updated`) ARE dispatched** by `KnowledgeGraphService.buildGraph`
  after a successful build — carrying `repositoryId`, `snapshotId`, `analysisId`.
- **NO handler is registered for either event** (verified: only `analysis.completed`
  and `enrichment.completed` have handlers). RFC-011 §12 requires exactly these triggers.
- Infrastructure: `InMemoryDomainEventDispatcher` (in-process; `registerHandler` called
  in module `onModuleInit`), event handler → enqueue BullMQ job → worker
  (`WorkerHost` processor) → application service → dispatch completion event. Queues
  (`analysis`, `knowledge-graph`, `ai-enrichment`) each have a DLQ, 3 attempts,
  exponential backoff (`RETRY_ATTEMPTS`/`RETRY_BACKOFF` constants).
- The documentation engine slots in identically: `DocumentationEventHandler` registers
  on `knowledge-graph.built`/`knowledge-graph.updated` → enqueue `documentation`
  queue → `DocumentationJobProcessor` → `DocumentationService.generate` →
  dispatch `documentation.generated`/`documentation.failed`.

---

## 8. What Exists to Reuse

| Asset                                       | Location                              | Reuse                        |
| ------------------------------------------- | ------------------------------------- | ---------------------------- |
| Full graph read (`findAllNodesAndEdges`)    | `GraphQueryService` (exported)        | Primary data source          |
| Request-flow assembly (`buildEndpointFlow`) | `GraphQueryService`                   | API Reference request paths  |
| Node/edge static helpers                    | `GraphQueryService`                   | Content projections          |
| Snapshot metadata incl. commitSha           | `GraphRepository`/`GraphQueryService` | Doc versioning               |
| AI enrichment merged into graph             | node `properties`                     | Deterministic enriched facts |
| `explain-module` capability                 | `ai/capabilities/` + registry         | AI module summaries          |
| Capability/prompt/template framework        | AI module                             | Doc AI enrichment            |
| Event dispatcher + queue + DLQ pattern      | shared + KG/AI modules                | Trigger + async generation   |
| Guard pattern (JWT + RepoMembership)        | KG module                             | Docs API security            |
| SSE streaming                               | `AIController`                        | Generation progress          |
| `ApiEndpointsView`                          | frontend                              | API reference UI             |
| Sidebar item model                          | frontend layout                       | Docs nav entry               |

## 9. What Must Be Built

**Backend — new `documentation` bounded context:**

1. MinIO module/service (first real usage) + bucket ensure + `DocStorageService` with
   RFC-011 §11 key scheme.
2. Doc template system: `DocTemplateLoader` (versioned YAML dirs), `DocTemplateRegistry`,
   YAML template files for the 5 doc types.
3. Content generators (deterministic): readme, architecture-guide, api-reference
   (reuses endpoint flow), module-docs, onboarding-guide.
4. Renderer registry + renderers: Markdown, JSON, Mermaid, PlantUML, OpenAPI (JSON v1);
   HTML; PDF deferred (see risks).
5. `DocumentArtifact` entity + migration + repository (Postgres metadata: repoId,
   analysisId, commitSha, type, format, objectKey, status, aiEnabled, version, timestamps).
6. Queue (`documentation` + DLQ), job processor, event handler wired to
   `knowledge-graph.built/updated`, `DocumentationService` orchestrator, dispatch of
   `documentation.generated/failed`.
7. `DocumentationController`: list artifacts, generate on-demand, get artifact, download
   (presigned URL), version history.
8. New AI capabilities for narrative sections (or batch doc-enrichment) — optional gate.

**Frontend:** 9. `repositories/[id]/docs` page (artifact list + generate) + `repositories/[id]/docs/[artifact]`
viewer; markdown renderer dependency; sidebar nav entry.

**Dependencies to add:** `yaml` (backend, templates + OpenAPI YAML later), markdown
renderer (frontend). PDF: `puppeteer` (deferred, optional).

## 10. Recommended File Structure

```
src/backend/src/modules/documentation/
├── documentation.module.ts            # registers event handler on knowledge-graph.built/updated
├── documentation.tokens.ts            # DOCUMENTATION_QUEUE/DLQ, DOC_TEMPLATE_REGISTRY, RENDERER_REGISTRY
├── domain/
│   ├── document-type.enum.ts          # README | ARCHITECTURE_GUIDE | API_REFERENCE | MODULE | ONBOARDING
│   ├── doc-format.enum.ts             # MARKDOWN | HTML | PDF | OPENAPI | MERMAID | PLANTUML | JSON
│   ├── doc-template.ts                # parsed YAML template VO
│   ├── doc-artifact.entity.ts         # aggregate root
│   ├── documentation-events.ts        # DocumentationGeneratedEvent / DocumentationFailedEvent
│   └── doc-build-status.enum.ts       # pending | building | generated | failed
├── application/
│   ├── documentation.service.ts       # orchestrator (graph → templates → content → enrich → render → store)
│   ├── doc-template-loader.service.ts # mirrors PromptTemplateLoader (versioned YAML dirs)
│   ├── doc-template-registry.service.ts # mirrors CapabilityRegistryService
│   ├── content-generators/
│   │   ├── content-generator.interface.ts
│   │   ├── readme.generator.ts
│   │   ├── architecture-guide.generator.ts
│   │   ├── api-reference.generator.ts
│   │   ├── module-docs.generator.ts
│   │   └── onboarding-guide.generator.ts
│   └── doc-enricher.service.ts        # optional AI sections via capability framework
├── infrastructure/
│   ├── controllers/documentation.controller.ts
│   ├── jobs/documentation.job-processor.ts      # mirrors knowledge-graph.job-processor (DLQ on final attempt)
│   ├── events/documentation-event-handler.ts    # knowledge-graph.built/updated → enqueue
│   ├── persistence/
│   │   ├── repositories/document-artifact.repository.ts
│   │   └── typeorm/document-artifact.typeorm-entity.ts
│   ├── storage/
│   │   ├── minio.module.ts / minio.service.ts   # shared object storage (bucket ensure, put/get/presign)
│   │   └── doc-storage.service.ts               # RFC-011 §11 key scheme
│   └── renderers/
│       ├── renderer.interface.ts
│       ├── markdown.renderer.ts
│       ├── json.renderer.ts
│       ├── mermaid.renderer.ts
│       ├── plantuml.renderer.ts
│       ├── openapi.renderer.ts
│       ├── html.renderer.ts
│       └── pdf.renderer.ts             # phase 2 (puppeteer)
├── templates/
│   ├── project-readme/v1/template.yaml
│   ├── architecture-guide/v1/template.yaml
│   ├── api-reference/v1/template.yaml
│   ├── module-documentation/v1/template.yaml
│   └── onboarding-guide/v1/template.yaml

src/frontend/src/
├── app/(dashboard)/repositories/[id]/docs/page.tsx           # artifact list + generate
├── app/(dashboard)/repositories/[id]/docs/[artifact]/page.tsx # viewer
└── components/documentation/
    ├── documentation-list.tsx
    ├── documentation-viewer.tsx      # markdown renderer
    └── documentation-generate-button.tsx
```

## 11. Key Risks and Unknowns

1. **Event docs + AsyncAPI are data-blocked.** The graph/IR captures no domain events.
   Scope them out of v1 or they become fake documentation. (Surfaces in proposal.)
2. **PDF export** via Puppeteer is heavy (browser dep, image bloat, security surface).
   Defer to a later phase; HTML→PDF can reuse the HTML renderer output when it lands.
3. **OpenAPI schema depth depends on AI enrichment.** DTO field-level schemas exist only
   when enrichment ran (`dtoFields`); deterministic path has endpoint/DTO references but
   not field shapes. OpenAPI exporter must handle missing schemas gracefully
   (e.g. type-only reference, empty schema with `additionalProperties`).
4. **First real MinIO usage.** Bucket provisioning, connection errors, test isolation
   (MinIO in tests), and presigned URLs are all greenfield — needs careful wiring and a
   `MinioService` unit/integration test with a mock or `minio` in CI.
5. **Architecture Guide C4 fidelity.** Full C4 context/container diagrams aren't derivable
   from the graph. v1 should produce component-level Mermaid diagrams (modules/services/
   dependencies) and clearly label the boundary.
6. **Performance.** Deterministic generation from one `findAllNodesAndEdges` call is
   fast; AI sections dominate cost. Enforce per-section AI control + per-analysis caching
   to hit RFC targets (<30s small repos).
7. **Incremental vs full regeneration.** RFC mentions incremental updates; versioned
   artifacts keyed by commit SHA make full regeneration safe and idempotent for v1.
   True diff-based generation is a later optimization.
8. **Template rendering engine.** No templating lib (mustache/ejs) in deps. The RFC
   YAML-section model may be rendered by a purpose-built section renderer rather than a
   generic template engine — decide in design; keep `sections[].source` bound to
   generator functions, not arbitrary code.

## 12. Suggested Architecture Approach

Follow the codebase's established bounded-context + event-driven recipe exactly:

1. **Trigger**: `DocumentationEventHandler` registered in `documentation.module.ts`
   `onModuleInit` for `knowledge-graph.built` / `knowledge-graph.updated` → enqueue
   `documentation` BullMQ job (3 attempts, exponential backoff, DLQ) — byte-for-byte
   the knowledge-graph pattern.
2. **Orchestrate**: `DocumentationService.generate(repoId, analysisId, commitSha)`:
   load full graph via exported `GraphQueryService.findAllNodesAndEdges` → select
   templates (`DocTemplateRegistry`) → run content generators per doc type →
   optional AI enrichment per section (capability framework) → render via
   `RendererRegistry` → persist artifact to MinIO + metadata row to Postgres →
   dispatch `documentation.generated`.
3. **Extensibility**: exporters plug into `RENDERER_REGISTRY` (same token-map pattern as
   `AI_PROVIDER_REGISTRY`/`PARSER_REGISTRY`); doc types plug into `DOC_TEMPLATE_REGISTRY`;
   new templates are YAML files, new renderers are new classes — no existing code
   modified (EPIC acceptance criterion).
4. **Deterministic-first, AI-optional**: all structural content from graph properties
   (which already include AI-derived `role`/`dtoFields` when enrichment ran); AI narrative
   only in explicitly enabled sections, flagged "Generated by AI".
5. **Storage**: MinIO object keys per RFC-011 §11 (`{org}/{repo}/{commitSha}/{type}.{fmt}`
   - `latest/`), Postgres metadata for index/history; download via presigned URL.
6. **v1 scope**: Markdown, JSON, Mermaid, PlantUML, OpenAPI (JSON) renderers + HTML;
   PDF and AsyncAPI deferred; event catalog/docs deferred until parser captures events.
7. **Frontend**: `[id]/docs` list + generate + `[id]/docs/[artifact]` viewer; reuse
   `ApiEndpointsView` inside the API reference view; markdown renderer dependency added.

## 13. Ready for Proposal

**Yes** — requirements (EPIC-009, RFC-011), data source (graph), trigger events
(`knowledge-graph.built/updated` — unclaimed), AI integration path (capability
framework + `explain-module` precedent), storage (MinIO provisioned), and frontend
insertion points are all verified against real code. The proposal should explicitly
scope OUT: AsyncAPI, event documentation, and PDF (phase 2), and flag the event-data
gap and OpenAPI schema-depth dependency on AI enrichment.
