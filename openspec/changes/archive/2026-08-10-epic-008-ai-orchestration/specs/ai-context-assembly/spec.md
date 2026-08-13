# ai-context-assembly Specification

> **Change**: EPIC-008 | **Type**: New | **Dependencies**: knowledge-graph-model (sourceFile, GraphQueryService)

## Purpose

Retrieve Knowledge Graph context for any AI capability, apply truncation when context exceeds budget, and cache results in Redis. Per RFC-009 §6 and §10.

## Requirements

| #   | Requirement                                 | Strength |
| --- | ------------------------------------------- | -------- |
| R1  | Context retrieval from GraphQueryService    | MUST     |
| R2  | Context truncation strategy                 | MUST     |
| R3  | Redis context cache                         | MUST     |
| R4  | Token budget enforcement (≤4000 ctx tokens) | MUST     |
| R5  | Source file allow-list / deny-list          | MUST     |

### Requirement: Context Retrieval from GraphQueryService

The `ContextAssembler` SHALL query `GraphQueryService.getNodeWithEdges(target_fqn, direction, depth)` to retrieve the target node, its direct relationships, and transitive relationships up to the configured `relationshipDepth`. It MUST also inject `AnalysisRepository` to resolve `sourceFile` paths (cross-reference: knowledge-graph-model §sourceFile).

#### Scenario: Assemble context for explain-module on a Module node

- GIVEN target FQN `src/orders/OrderService.ts` with `relationshipDepth: 1`
- WHEN context is assembled
- THEN the result includes: target node properties, direct dependents, direct dependencies, and API surface
- AND transitive relationships at depth 2+ are excluded

### Requirement: Context Truncation Strategy

When assembled context exceeds `maxContextTokens` (default 4000), the assembler SHALL: (1) prioritize direct relationships over transitive ones, (2) truncate relationship lists and mark the truncation point with `[TRUNCATED: N items omitted]`, (3) set `truncated: true` in the context envelope for downstream observability.

#### Scenario: Large module truncates transitive relationships

- GIVEN a target node with 50+ direct relationships exceeding the 4000-token budget
- WHEN context is assembled
- THEN only the first N relationships fit within budget
- AND the context includes `truncated: true` and a `[TRUNCATED]` marker visible to the LLM

### Requirement: Redis Context Cache

Context SHALL be cached in Redis with key `context:{capability}:{nodeId}:{depth}`, TTL 5 minutes. Cache entries SHALL be invalidated when the Knowledge Graph for the relevant repository is updated (`KnowledgeGraphUpdated` event). Cache hits SHALL set `cache_hit: true` in observability.

#### Scenario: Repeated capability invocation hits cache

- GIVEN context for `explain-module:node-42:1` is cached
- WHEN the same capability + node + depth is requested within 5 minutes
- THEN the context is served from cache (no GraphQueryService call)
- AND assembly latency is <10ms (RFC-009 §13)

### Requirement: Token Budget Enforcement

The assembler SHALL enforce a context token budget of ≤4000 tokens. If truncation cannot reduce context below the budget (e.g., a single node's properties are too large), the assembler SHALL raise a `ContextBudgetExceededError` with the actual token count.

#### Scenario: Context fits within budget

- GIVEN assembled context is 3200 tokens
- WHEN the budget check runs
- THEN no truncation is applied and `truncated: false`

### Requirement: Source File Allow-List / Deny-List

Source file paths sent to providers MUST pass an allow-list + deny-list check. Allow-list: extensions `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.java`, `.go`. Deny-list: filenames matching `.env*`, `*.pem`, `*.key`, `*secret*`, `*credentials*`, and config files containing secrets. Files failing the check SHALL be excluded from context silently.

#### Scenario: .env file excluded from context

- GIVEN a node's `sourceFile` resolves to `.env.local`
- WHEN the allow-list check runs
- THEN the file is excluded and does not appear in assembled context

> **Cross-reference**: knowledge-graph-model provides `sourceFile` on nodes. ai-observability records `truncated` and `cache_hit`.
