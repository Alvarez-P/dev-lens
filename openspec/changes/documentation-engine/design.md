# Design: Documentation Engine (EPIC-009 / RFC-011)

## Technical Approach

New `documentation` bounded context (`src/backend/src/modules/documentation/`) that consumes the
Knowledge Graph through the already-exported `GraphQueryService` and produces versioned, multi-format
doc artifacts into MinIO + Postgres metadata. The pipeline clones the knowledge-graph
event→queue→worker recipe byte-for-byte (RFC-011 §5.1, §12): `DocumentationEventHandler` (registers on
`knowledge-graph.built/updated`) → `documentation` BullMQ queue → `DocumentationJobProcessor` →
`DocumentationService.generate()`. Deterministic-first, AI-optional (RFC-011 §8.2).

```
graph.built ──▶ DocumentationEventHandler ──▶ documentation queue ──▶ JobProcessor ──▶ DocumentationService
                                                                                           │
   template select ──▶ content extract ──▶ [AI enrich] ──▶ render (registry) ──▶ MinIO + Postgres
                                                                                           │
                                                                          documentation.generated/failed
```

## Architecture Decisions

| Decision                      | Option A                                                       | Option B                                                          | Chosen + Rationale                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer registry             | `Map` factory like `AI_PROVIDER_REGISTRY` (`ai.module.ts:134`) | NestJS `multi: true` token `FORMAT_RENDERER`                      | **A** — NestJS 10.4.15 has NO multi-provider support (`multi` is an Angular DI concept, absent from `@nestjs/common`/`@nestjs/core`; a second provider on the same token overwrites the first). The `AI_PROVIDER_REGISTRY` factory pattern assembles the renderer array and keeps renderers open for extension with zero registry edits. Resolver injects `IDocFormatRenderer[]`, indexes by `.format`. |
| Section vs document rendering | One registry for both                                          | Two layers                                                        | **Two layers** — `sections[].format` (`table`/`list`/`mermaid-class-diagram`/…) are Markdown _fragments_ produced inside `MarkdownRenderer`; document formats (`markdown`/`html`/`openapi`/`mermaid`/`plantuml`/`json`) are the registry entries. Matches `documentation-formats` R2 vs R5/R6.                                                                                                          |
| MinIO service location        | `shared/infrastructure/storage/`                               | `documentation/infrastructure/storage/`                           | **B** (per exploration §10) — first real usage, single consumer; exported from `DocumentationModule` for later lift. Mirrors `minio@8.0.3` client construction in `health.controller.ts:54`.                                                                                                                                                                                                            |
| AI enrichment                 | Reuse full `AIService`/capability framework                    | Thin `DocEnricherService` over exported `ProviderSelectorService` | **B** — `AiModule` exports `ProviderSelectorService` but NOT `AIService`/`CapabilityPromptBuilder`; keeps "Modified Capabilities: None". Gated behind `config.documentation.aiEnabled`, per-section, flagged.                                                                                                                                                                                           |
| Progress                      | Persist progress events to Postgres                            | BullMQ `job.updateProgress()` + job-state endpoint                | **B** — BullMQ natively persists progress to Redis; poll `GET /docs/jobs/:jobId`. The in-process dispatcher cannot be polled cross-process.                                                                                                                                                                                                                                                             |
| MinIO key org component       | Require org                                                    | Fallback chain `organizationId ?? workspaceId ?? ownerId`         | **B** — `Repository.organizationId`/`workspaceId` are nullable (`repository.entity.ts:21-22`); RFC-011 §11 key must always resolve.                                                                                                                                                                                                                                                                     |

## Module Layout (file changes)

All under `src/backend/src/modules/documentation/` (mirrors `knowledge-graph/` + `ai/` structure):

| Path                                                                                               | Action | Purpose                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentation.module.ts`                                                                          | Create | registers event handler in `onModuleInit` (like `knowledge-graph.module.ts:54`); bucket ensure                                                                                                     |
| `documentation.tokens.ts`                                                                          | Create | `DOCUMENTATION_QUEUE`, `DOCUMENTATION_DLQ`, `FORMAT_RENDERER`, `DOC_TEMPLATE_REGISTRY`                                                                                                             |
| `domain/doc-type.enum.ts`, `doc-format.enum.ts`, `doc-build-status.enum.ts`                        | Create | value enums                                                                                                                                                                                        |
| `domain/doc-template.ts`                                                                           | Create | parsed YAML template VO                                                                                                                                                                            |
| `domain/doc-artifact.entity.ts`                                                                    | Create | aggregate root (extends `AggregateRoot<DocArtifactId>`); fields per `documentation-storage` R4 + `status`                                                                                          |
| `domain/documentation-events.ts`                                                                   | Create | `DocumentationStarted/Progress/Generated/FailedEvent` (mirrors `graph-events.ts`)                                                                                                                  |
| `application/documentation.service.ts`                                                             | Create | orchestrator; `generate(repoId, analysisId, {docTypes?, force?})`                                                                                                                                  |
| `application/doc-template-loader.service.ts`                                                       | Create | mirrors `PromptTemplateLoader` (`ai/application/prompt-template-loader.service.ts`); scans `templates/{type}/v{n}/template.yml`                                                                    |
| `application/doc-template-registry.service.ts`                                                     | Create | mirrors `CapabilityRegistryService` (`ai/application/capability-registry.service.ts`); keyed `(type, version)`                                                                                     |
| `application/content-generators/*.ts`                                                              | Create | `IDocContentGenerator` + `readme`, `architecture-guide`, `api-reference`, `module-docs`, `onboarding-guide` — pure fns over `findAllNodesAndEdges` output using `GraphQueryService` static helpers |
| `application/doc-enricher.service.ts`                                                              | Create | AI sections via `ProviderSelectorService` + Redis cache (90d) keyed `(filePath, contentHash)`                                                                                                      |
| `application/doc-format-policy.ts`                                                                 | Create | docType → formats matrix (below)                                                                                                                                                                   |
| `infrastructure/renderers/*.ts`                                                                    | Create | `IDocFormatRenderer` + `markdown`, `html`, `openapi`, `mermaid`, `plantuml`, `json` renderers                                                                                                      |
| `infrastructure/events/documentation-event-handler.ts`                                             | Create | `knowledge-graph.built/updated` → enqueue; flag-gated                                                                                                                                              |
| `infrastructure/jobs/documentation.job-processor.ts`                                               | Create | mirrors `knowledge-graph.job-processor.ts` (DLQ on final attempt, `job.updateProgress`)                                                                                                            |
| `infrastructure/storage/minio.service.ts`, `doc-storage.service.ts`                                | Create | bucket ensure + RFC-011 §11 key scheme + presign                                                                                                                                                   |
| `infrastructure/persistence/{repositories,typeorm}/document-artifact.*`                            | Create | repo + TypeORM entity; index `(repositoryId, commitSha, docType, templateVersion)`                                                                                                                 |
| `infrastructure/controllers/documentation.controller.ts`                                           | Create | REST list/get/download/delete/generate/regenerate + jobs/:jobId; `JwtAuthGuard` + `RepoMembershipGuard` (reuse `knowledge-graph/guards/repo-membership.guard.ts`)                                  |
| `templates/{readme,architecture-guide,api-reference,module-docs,onboarding-guide}/v1/template.yml` | Create | 5 built-in v1 templates                                                                                                                                                                            |
| `src/backend/src/app.module.ts`                                                                    | Modify | register `DocumentationModule`                                                                                                                                                                     |
| `src/backend/package.json`                                                                         | Modify | add `yaml`, `marked`                                                                                                                                                                               |
| `src/frontend/package.json`                                                                        | Modify | add `react-markdown`, `remark-gfm`, `mermaid`, `rehype-highlight`                                                                                                                                  |
| `src/frontend/src/app/(dashboard)/repositories/[id]/docs/{page.tsx,[artifact]/page.tsx}`           | Create | list + viewer (client components, TanStack Query via `lib/api-client`)                                                                                                                             |
| `src/frontend/src/components/documentation/*.tsx`                                                  | Create | list, viewer, generate button                                                                                                                                                                      |
| `src/frontend/src/app/(dashboard)/repositories/[id]/page.tsx`                                      | Modify | add "Documentation" nav link (alongside "API Endpoints" at line 161)                                                                                                                               |

## Data Flow (generation job)

`DocumentationService.generate(repoId, analysisId, {docTypes, force})`:

1. Resolve `commitSha` + `version` via `GraphQueryService.getLatestGraphSnapshot` (or `findAllNodesAndEdges`).
2. Load graph `GraphQueryService.findAllNodesAndEdges(repoId)`.
3. Select templates via `DocTemplateRegistry` filtered by `docTypes` (controller template → merge `module-docs` + `api-reference`).
4. Run `IDocContentGenerator` per template → `GeneratedDocument` (structured sections).
5. `DocEnricherService` for `source: ai.enrich(...)` sections (cache-checked, flagged).
6. For each format in `DocFormatPolicy[docType]`, resolve `FORMAT_RENDERER` → render.
7. `DocStorageService.put` commit-key + `latest/` copy (RFC-011 §11); persist `DocArtifact`.
8. Dispatch `documentation.completed`.

Idempotency (R4): skip docType when `DocArtifact` exists for `(repoId, commitSha, docType, templateVersion)`; `force` (regenerate) bypasses.

## Interfaces / Contracts

```ts
// infrastructure/renderers/renderer.interface.ts
interface IDocFormatRenderer {
  readonly format: DocFormat; // markdown|html|openapi|mermaid|plantuml|json
  render(doc: GeneratedDocument): RenderedArtifact; // { format, contentType, ext, buffer }
}

// application/content-generators/content-generator.interface.ts
interface IDocContentGenerator {
  readonly docType: DocType;
  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument;
}

// application/documentation.service.ts (job data)
interface DocumentationJobData {
  repositoryId: string;
  analysisId: string;
  docTypes?: DocType[];
  force?: boolean;
}
```

DocFormatPolicy (module constant): `readme`→`[markdown,html]`; `architecture-guide`→`[markdown,html,mermaid]`;
`api-reference`→`[markdown,html,openapi,json]`; `module-docs`→`[markdown,html]`; `onboarding-guide`→`[markdown,html]`.

## Testing Strategy (strict TDD — RED→GREEN→REFACTOR)

Backend unit specs live in `src/backend/test/unit/modules/documentation/` (Jest 29); frontend co-located `__tests__/` (Vitest 2.1).

| Capability                    | Unit (Jest/Vitest)                                                                                                                      | Integration                                    | E2E                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| documentation-storage         | `minio.service` (mocked `minio` client), `doc-storage` key scheme, `doc-artifact` entity/repo                                           | `minio` in CI (bucket ensure, put/get/presign) | —                                         |
| documentation-template-system | loader (fixture YAML dirs), registry, parse-error paths                                                                                 | —                                              | —                                         |
| documentation-formats         | each renderer (table/list/fence/mermaid/plantuml/OpenAPI-degrade/JSON)                                                                  | —                                              | —                                         |
| documentation-generation      | content generators (pure fns over fixture graph), `DocumentationService` with mocked deps, event handler, job processor, enricher cache | `BullMQ` job → artifact round-trip (supertest) | —                                         |
| documentation-api             | controller (guard, 400/404/403 paths)                                                                                                   | supertest list/get/download/delete/regenerate  | —                                         |
| documentation-views           | components + hook state (Vitest/RTL)                                                                                                    | —                                              | Playwright: docs list → generate → viewer |

## Migration / Rollout

No data migration — additive module, new table, new queue, new bucket. Rollback: remove module
registration + flag `DOCUMENTATION_ENABLED=false` (gates event handler; on-demand endpoints stay safe).
Versioned templates allow pointing the registry at a prior `v{n}`.

## Resolved Decisions (user-approved)

- [x] HTML rendering uses `marked` on the backend (spec `documentation-formats` R3) — add `marked` (+ `marked-mermaid` if needed) as a backend dependency. HTML is generated server-side as a self-contained document; frontend renders the stored artifact.
- [x] `doc-format-policy.ts` matrix (docType → formats) is in scope. Kept as a module constant: `readme`→`[markdown,html]`; `architecture-guide`→`[markdown,html,mermaid]`; `api-reference`→`[markdown,html,openapi,json]`; `module-docs`→`[markdown,html]`; `onboarding-guide`→`[markdown,html]`.

## Risks

- First real MinIO usage (Med) — dedicated `MinioService` tests with mocked client + CI integration.
- OpenAPI schema depth depends on AI `dtoFields` (Med) — graceful `type: object` degradation.
- AI cost (Med) — per-section enablement + 90d Redis cache.
- Event/AsyncAPI + PDF out of scope (parser captures no events; Puppeteer deferred).
