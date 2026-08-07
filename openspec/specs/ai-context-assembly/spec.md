# ai-context-assembly Specification

> **Archived from**: `ai-enrichment` (2026-08-07)

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
