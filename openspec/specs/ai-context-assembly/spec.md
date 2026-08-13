# ai-context-assembly Specification

> **Archived from**: `ai-enrichment` (2026-08-07)
> **Updated by**: `epic-008-ai-orchestration` (2026-08-10) — capability context assembly (GraphQueryService retrieval, truncation strategy, Redis context cache, ≤4000 token budget, source-file allow/deny-list for provider sends)

## Purpose

Assemble minimal, signature-level context for LLM enrichment from the Knowledge Graph and Intermediate Representation — never raw source files. Per RFC-009 §6.1, context is assembled from the KG; per the exploration §3, the CodeSketch format includes only class signatures, decorators with arguments, and FQN-resolved imports — no method bodies, no comments, no non-route string literals.

## Requirements

### Requirement: ContextAssembler Service Contract

`ContextAssembler` SHALL read context exclusively from `GraphQueryService` (service-level DI, not HTTP) and `AnalysisRepository` (for IR). It MUST NOT read filesystem source files directly. The assembler SHALL produce a `CodeSketch[]` array — one sketch per analysis unit (file), with a hard cap of 4000 tokens per sketch. Total assembly output SHALL fit within 5000 tokens, leaving 1000 tokens for prompt framing (system, instructions, KG context). The assembler MUST be injected as `@Injectable()` and consumed by the enrichment pipeline — never by controllers.

#### Scenario: Context assembled from KG and IR for a single file

- GIVEN an `analysis.completed` event with `analysisId = 'X'` and a repository with `src/users/users.controller.ts`
- WHEN `ContextAssembler.assemble(analysisId)` is called
- THEN `GraphQueryService` is queried for the Controller node and its BELONGS_TO/DEPENDS_ON edges
- AND `AnalysisRepository.findById('X')` loads the IR for class-level detail (decorators, methods, imports)
- AND one `CodeSketch` is produced for `users.controller.ts`
- AND no filesystem read occurs within the assembler

#### Scenario: Empty module produces empty sketch array

- GIVEN a repository with no source files matching the allow-list
- WHEN the assembler builds sketches
- THEN the returned `CodeSketch[]` is empty
- AND the enrichment pipeline skips the LLM call gracefully

### Requirement: CodeSketch Serialization Format

A `CodeSketch` SHALL include (and ONLY include):

| Field               | Source                      | Description                                                                           |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `sourceFile`        | `IrNode.filePath`           | Relative path from repo root                                                          |
| `className`         | IR class name               | Top-level class name                                                                  |
| `decorators`        | IR class decorators         | Decorator names WITH arguments (e.g., `@Controller('users')`, `@UseGuards(JwtGuard)`) |
| `extends`           | IR `extends` clause         | FQN of parent class, if any                                                           |
| `implements`        | IR `implements` clause      | FQNs of implemented interfaces                                                        |
| `constructorParams` | IR constructor              | Array of `{ name, type, decorators[] }`                                               |
| `methods`           | IR methods                  | Array of `{ name, decorators[], params: [{ name, type, decorators[] }], returnType }` |
| `imports`           | IR imports resolved to FQNs | Deduplicated; external packages as bare name; relative imports as FQN                 |
| `truncated`         | Boolean                     | `true` if sketch exceeds 4000 tokens                                                  |

A CodeSketch MUST NOT include: method bodies, comments, string literals (except route-path decorator arguments), private helper methods without decorators, or any content from `.env*` or non-source-extension files.

#### Scenario: Full sketch preserves all decorator arguments

- GIVEN a class `UsersController` with `@Controller('users')`, `@UseGuards(JwtGuard)`, and a method `create` with `@Post()`, `@UsePipes(ValidationPipe)`, parameter `@Body() body: CreateUserDto`, and return type `Promise<UserDto>`
- WHEN the sketch is built
- THEN `decorators` includes `@Controller('users')` and `@UseGuards(JwtGuard)` with arguments
- AND `methods[0].decorators` includes `@Post()` and `@UsePipes(ValidationPipe)`
- AND `methods[0].params[0]` includes `{ name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] }`
- AND `methods[0].returnType` is `Promise<UserDto>`
- AND no method body code appears

#### Scenario: Comments stripped from sketch

- GIVEN a source file containing `// TODO: refactor this` and `/* block comment */`
- WHEN the sketch builder processes it
- THEN neither comment appears in the serialized sketch output

#### Scenario: Non-route string literals stripped

- GIVEN a service class with `this.logger.log('User created successfully')`
- WHEN the sketch builder processes it
- THEN the string literal `'User created successfully'` is excluded
- AND only route-path decorator arguments survive (e.g., `@Get('users/:id')`)

#### Scenario: Private helpers without decorators excluded

- GIVEN a controller with a public decorated method `getAll` and a private helper `sanitizeInput`
- WHEN the sketch builder processes it
- THEN `getAll` appears in the `methods` array with its decorators
- AND `sanitizeInput` is completely excluded from the sketch

### Requirement: Truncation Integrity

Each `CodeSketch` SHALL be capped at 4000 tokens (~16000 chars). If truncation is needed, the builder SHALL:

1. Include the class signature, decorators, extends/implements, and constructor params in full (these always fit).
2. Include methods in declaration order until the budget is exhausted.
3. Set `truncated: true` and include a metadata field `omittedMethodCount`.
4. Never truncate mid-method — partial signatures cause LLM confusion.

The presence of `truncated: true` SHALL be visible to the prompt builder, which MUST add an explicit instruction: "Some methods were truncated. Do NOT fabricate or guess omitted endpoints."

#### Scenario: Large file truncated with integrity marker

- GIVEN a controller with 200 methods, where only 30 fit within 4000 tokens
- WHEN the sketch is built
- THEN `truncated` is `true`
- AND `omittedMethodCount` is `170`
- AND all included methods are complete signatures (not partial)
- AND the class-level signature is present

#### Scenario: Small file not truncated

- GIVEN a controller with 5 methods totaling 800 tokens
- WHEN the sketch is built
- THEN `truncated` is `false`
- AND no `omittedMethodCount` field is present

### Requirement: File Allow/Deny-List Enforcement

The assembler SHALL enforce a strict source-file allow-list and deny-list BEFORE sketch construction:

| List      | Rule                                                             | Action                                                 |
| --------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| **Allow** | Extensions: `.ts`, `.tsx`, `.js`, `.jsx`                         | Include if file path matches                           |
| **Deny**  | Pattern: `.env*` (`.env`, `.env.local`, `.env.production`, etc.) | **Exclude unconditionally** — never include in context |
| **Deny**  | Paths matching `IGNORED_DIRECTORIES`                             | Exclude per existing glob patterns                     |
| **Deny**  | Non-text/binary files                                            | Exclude (language detection already filters)           |

Files not matching the allow-list SHALL be silently skipped. Files matching any deny rule SHALL be logged at `warn` level with the file path and rule that excluded it.

#### Scenario: .env files blocked unconditionally

- GIVEN a repository containing `.env`, `.env.local`, and `.env.production`
- WHEN the assembler enumerates files for sketching
- THEN all three files are excluded
- AND a warning is logged: `"AI context: excluded .env (deny-list rule: .env*)"`
- AND no `.env` content enters any sketch

#### Scenario: Non-source file skipped silently

- GIVEN a repository with `package.json`, `tsconfig.json`, and `Dockerfile` alongside `.ts` files
- WHEN the assembler processes the file list
- THEN only `.ts/.tsx` files are included
- AND non-source files are silently skipped (no warning)

### Requirement: Token Budget Guard

Before returning assembled context, `ContextAssembler` SHALL verify the total estimated token count (using the ~4 chars/token heuristic per the design). If total exceeds 5000 tokens, the assembler SHALL truncate the sketch array (drop lowest-priority files first: non-controller modules before controllers) until the budget fits. This guard MUST run on every `assemble()` call — it is the first line of budget defense before the prompt builder's own check.

#### Scenario: Budget exceeded triggers priority-based truncation

- GIVEN sketches for 50 files totaling 8000 tokens
- WHEN `assemble()` completes
- THEN only the highest-priority files remain (controllers > services > DTOs > others)
- AND the total is ≤ 5000 tokens
- AND a warning is logged with the number of dropped files

#### Scenario: Within budget, no truncation

- GIVEN sketches for 10 files totaling 3000 tokens
- WHEN `assemble()` completes
- THEN all 10 sketches are returned
- AND no priority truncation occurs

### Requirement: Content-Addressed Caching

The assembler SHALL cache sketch output keyed by `ai:sketch:{sha256(fileContent)}`. Sketch computation is a pure function of file content — same file content always produces the same sketch. Caching SHALL use the `FileManifestService` (already computing sha256 per file during analysis) to avoid redundant computation. Cache TTL is indefinite (content-addressed — a different sha256 means different content). The enrichment pipeline's per-unit `manifestSha256` lookup SHALL hit this cache before building sketches.

#### Scenario: Cache hit skips sketch build

- GIVEN `ai:sketch:{sha256}` exists in Redis for a file
- WHEN the assembler processes that file
- THEN the cached `CodeSketch` is returned
- AND no IR query or sketch serialization is performed

#### Scenario: Cache miss builds and stores

- GIVEN no cached sketch for a file's sha256
- WHEN the assembler processes that file
- THEN a new `CodeSketch` is built from IR
- AND stored in Redis under `ai:sketch:{sha256}`

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
