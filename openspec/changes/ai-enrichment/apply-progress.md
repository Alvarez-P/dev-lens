# Apply Progress: ai-enrichment — PR 1 (KG Foundation, Gap G1)

Branch: `feat/ai-enrichment` (base: `main` → feature-branch-chain PR #1)
Artifact store: openspec | Strict TDD: RED → GREEN per task
Scope: Phase 1 only — tasks 1.1, 1.2, 1.3. Phases 2-5 belong to later PRs.

## TDD Cycle Evidence

| Task | Test File                                                                            | Layer | RED     | GREEN | Notes                                        |
| ---- | ------------------------------------------------------------------------------------ | ----- | ------- | ----- | -------------------------------------------- |
| 1.1  | `graph-node.vo.spec.ts`                                                              | Unit  | Written | 21/21 | create/reconstitute/toJSON/equality coverage |
| 1.2  | `typeorm-entities.spec.ts`                                                           | Unit  | n/a     | 18/18 | column metadata + snake_case assertions      |
| 1.3  | `graph.builder.spec.ts` + `graph.repository.spec.ts` + `graph-query.service.spec.ts` | Unit  | Written | 54/54 | propagation, persistence round-trip, query   |

## Test Summary

- `npx jest` (full backend): 63 suites, 509 tests, 0 failures
- `npx tsc --noEmit`: 0 errors
- Layers: Unit (all three tasks)

## Files Changed

| File                                                                                                      | Action | Description                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/backend/src/modules/knowledge-graph/domain/graph-node.vo.ts`                                         | Modify | Add `sourceFile: string \| null` to constructor, create/reconstitute (default null), toJSON, equality components |
| `src/backend/src/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity.ts` | Modify | Add `source_file TEXT NULL` column                                                                               |
| `src/backend/src/shared/infrastructure/persistence/migrations/1786147200000-AddSourceFileToGraphNodes.ts` | Create | `ALTER TABLE graph_nodes ADD COLUMN source_file TEXT NULL` (down: DROP COLUMN)                                   |
| `src/backend/src/modules/knowledge-graph/application/graph.builder.ts`                                    | Modify | Propagate `semanticNode.sourceFile` → `GraphNode.sourceFile`; deprecated copies carry sourceFile                 |
| `src/backend/src/modules/knowledge-graph/infrastructure/persistence/repositories/graph.repository.ts`     | Modify | Map `node.sourceFile` ↔ `entity.source_file` in both directions                                                  |
| `src/backend/src/modules/knowledge-graph/application/graph-query.service.ts`                              | Modify | Add `getNodesByFile` static helper                                                                               |
| 4 test files                                                                                              | Modify | New RED→GREEN tests + column metadata assertions                                                                 |

## Deviations / Decisions

- **Kept `properties.filePath` merge** in `graph.builder.ts` alongside the new dedicated `source_file` column. Rationale: frontend `src/frontend/src/components/graph/canvas/filter.ts` derives architectural layers from `properties.filePath`; spec REQ-KG-001 requires backward compatibility. The dedicated column is additive; `properties.filePath` stays for the current frontend contract.
- `sourceFile` param defaults to `null` in create/reconstitute — old snapshots hydrate as `null` (spec "Old snapshot has null sourceFile" scenario).
- Migration follows the existing `src/shared/infrastructure/persistence/migrations/` convention (timestamped file; `synchronize` handles dev schema, migration covers prod).

## Next PRs (out of scope here)

PR 2: AI domain + config + provider abstraction. PR 3: context assembly + prompts. PR 4: pipeline, gates, KG merge, RFC-009.
