# Tasks: Documentation Engine (EPIC-009 / RFC-011)

## Workload Forecast

Estimated changed lines: 3,500–4,500

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Slices: PR1→main/tracker, PR2→PR1, PR3→PR2, PR4→PR3, PR5→PR4, PR6→PR5. TDD: spec-first.

## Phase 1: Foundation

- [x] 1.1 [T] `documentation.tokens.ts`: QUEUE/DLQ/FORMAT_RENDERER/DOC_TEMPLATE_REGISTRY (`formats` R1)
- [x] 1.2 [T] enums doc-type, doc-format, doc-build-status (`storage` R4)
- [x] 1.3 [T] `application/doc-format-policy.ts` matrix (R1; decision 2)
- [x] 1.4 [T] `domain/doc-template.ts` VO: YAML parse/validate (template R1)
- [x] 1.5 [T] `domain/doc-artifact.entity.ts` + `documentation-events.ts` (storage R4; gen R5)
- [x] 1.6 Backend deps: `yaml`, `marked` (`formats` R3)
- [x] 1.7 [T] `renderers/renderer.interface.ts` + `FORMAT_RENDERER` factory-array (R1)

## Phase 2: Renderers

- [x] 2.1 [T] `markdown.renderer.ts`: table/list/fenced-mermaid/plantuml/raw, `##` titles (R2)
- [x] 2.2 [T] `html.renderer.ts`: `marked` → self-contained HTML, mermaid `<pre>` (R3)
- [x] 2.3 [T] `openapi.renderer.ts`: 3.0 doc, `type: object` degrade (R4)
- [x] 2.4 [T] `mermaid.renderer.ts`: classDiagram + flowchart (R5)
- [x] 2.5 [T] `plantuml.renderer.ts`: `@startuml`…`@enduml` (R6)
- [x] 2.6 [T] `json.renderer.ts`: full dump incl. metadata (R7)

## Phase 3: Template System

- [x] 3.1 [T] `doc-template-loader.service.ts`: scan `templates/{type}/v{n}/template.yml`, corrupt-file fail-fast (R1, R6)
- [x] 3.2 [T] `doc-template-registry.service.ts`: keyed (type,version), built-in fallback, controller merge (R5)
- [x] 3.3 Create 5 built-in `templates/{type}/v1/template.yml` — readme, architecture-guide, api-reference, module-docs, onboarding-guide (R7, R2, R4)

## Phase 4: Storage

- [x] 4.1 [T] `storage/minio.service.ts`: idempotent `devlens-docs` bucket ensure (R1)
- [x] 4.2 [T] `storage/doc-storage.service.ts`: key `{org}/{repo}/{commitSha}/{docType}.{format}` + `latest/` copy + presign (R2, R3, api R3; org fallback per design)
- [x] 4.3 [T] `persistence/{repositories,typeorm}/doc-artifact.*`: entity + repo, index `(repositoryId, commitSha, docType, templateVersion)` (R4, R5)

## Phase 5: Generation Core

- [x] 5.1 [T] `content-generators/content-generator.interface.ts` + `GeneratedDocument` (R3)
- [x] 5.2 [T] 5 `content-generators/*.ts` over `GraphQueryService` (template R2, R4)
- [x] 5.3 [T] `doc-enricher.service.ts`: `ProviderSelectorService` + Redis 90d cache `(filePath, contentHash)` (R6)
- [x] 5.4 [T] `documentation.service.ts`: 5-stage pipeline, idempotent skip, `force`, progress events (R3, R4, R5)

## Phase 6: Jobs & API

- [x] 6.1 [T] `events/documentation-event-handler.ts`: built/updated → enqueue, flag-gated (gen R1)
- [x] 6.2 [T] `jobs/documentation.job-processor.ts`: DLQ final attempt, `job.updateProgress` (gen R5)
- [x] 6.3 [T] `controllers/documentation.controller.ts`: generate/list/get/download/delete/regenerate + `jobs/:jobId`, owner-only delete, guards (api R1–R7)
- [x] 6.4 `documentation.module.ts`: wire, `onModuleInit` handler + bucket ensure (storage R1)
- [x] 6.5 `app.module.ts`: register `DocumentationModule`

## Phase 7: Frontend Views

- [x] 7.1 Frontend deps: `react-markdown`, `remark-gfm`, `mermaid`, `rehype-highlight`
- [x] 7.2 [T] `docs/page.tsx` + list components: grouped cards, empty state (R1, R2, R7)
- [x] 7.3 [T] `docs/[artifact]/page.tsx` + viewer: markdown, mermaid, highlight, AI badge (R3, R6)
- [x] 7.4 [T] generate button + progress polling + download buttons (R4, R5)
- [x] 7.5 `page.tsx`: "Documentation" nav link (R8)

## Phase 8: Verification

- [ ] 8.1 supertest: BullMQ job → MinIO + Postgres round-trip (gen R3; storage R2)
- [ ] 8.2 supertest: 401/403 guards, 400 docType, 404, delete 204/403 (api R1–R7)
- [ ] 8.3 Playwright e2e: docs list → generate → viewer
- [ ] 8.4 `pnpm -r test`/build

Backend: `src/backend/src/modules/documentation/`. Frontend: `src/frontend/src/app/(dashboard)/repositories/[id]/`.
