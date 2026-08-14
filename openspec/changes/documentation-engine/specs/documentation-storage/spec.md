# documentation-storage Specification

## Purpose

Define artifact storage in MinIO and metadata persistence in PostgreSQL. Generated documentation artifacts are stored under a deterministic path scheme with symlink-based latest pointers, and all metadata is queryable. Per RFC-011 §11.

## Requirements

| #   | Requirement               | Strength |
| --- | ------------------------- | -------- |
| R1  | MinIO bucket provisioning | MUST     |
| R2  | Artifact path scheme      | MUST     |
| R3  | Latest pointer            | MUST     |
| R4  | DocArtifact metadata      | MUST     |
| R5  | Historical retention      | MUST     |
| R6  | Streaming download        | MUST     |

### Requirement: MinIO Bucket Provisioning

The documentation module SHALL ensure the `devlens-docs` MinIO bucket exists on module initialization. Bucket creation SHALL be idempotent — if the bucket already exists, no action is taken and no error is thrown. The module SHALL use the existing `MinioService` infrastructure.

#### Scenario: Bucket created on first module initialization

- GIVEN the `devlens-docs` bucket does not exist in MinIO
- WHEN the documentation module initializes
- THEN the bucket is created
- AND subsequent artifact storage operations succeed

#### Scenario: Bucket creation is idempotent

- GIVEN the `devlens-docs` bucket already exists
- WHEN the documentation module initializes
- THEN no error is thrown
- AND the existing bucket is used

### Requirement: Artifact Path Scheme

Generated documentation SHALL be stored in MinIO under the path: `{organizationId}/{repositoryId}/{commitSha}/{docType}.{format}`. The path components SHALL be derived from the repository's organization, repository ID, the commit SHA at generation time, the document type name, and the format extension (e.g., `md`, `html`, `json`, `openapi.json`).

#### Scenario: README in Markdown stored at correct path

- GIVEN a repository with orgId `org-1`, repoId `repo-42`, commit SHA `abc123`
- WHEN a README Markdown artifact is stored
- THEN the MinIO key is `org-1/repo-42/abc123/readme.md`

#### Scenario: API Reference as OpenAPI stored at correct path

- GIVEN the same repository context
- WHEN an API Reference OpenAPI JSON artifact is stored
- THEN the MinIO key is `org-1/repo-42/abc123/api-reference.openapi.json`

### Requirement: Latest Pointer

In addition to the commit-specific path, the most recent version of each artifact SHALL also be stored at `{organizationId}/{repositoryId}/latest/{docType}.{format}`. This SHALL be a separate object copy (not a symlink, as MinIO does not support symlinks) written atomically with the commit-specific object. The latest pointer SHALL enable fast retrieval without querying commit history.

#### Scenario: Latest pointer updated on each generation

- GIVEN a README is generated for commit SHA `abc123`
- WHEN the artifact is stored at `org-1/repo-42/abc123/readme.md`
- THEN a copy is also stored at `org-1/repo-42/latest/readme.md`

#### Scenario: Latest pointer overwritten by newer generation

- GIVEN an existing latest pointer pointing to commit `abc123`'s artifact
- WHEN a new generation for commit `def456` completes
- THEN the latest pointer is overwritten with the `def456` artifact content

### Requirement: DocArtifact Metadata

Every generated artifact SHALL have a corresponding `DocArtifact` entity in PostgreSQL with these fields: `id` (UUID, primary key), `repositoryId` (string, foreign key), `commitSha` (string), `docType` (string, enum of doc types), `format` (string), `minioKey` (string, full object key), `sizeBytes` (number), `generatedAt` (datetime), `templateVersion` (string), `aiModelVersion` (string, nullable). The entity SHALL be indexed on `(repositoryId, commitSha, docType, templateVersion)` for idempotency checks.

#### Scenario: DocArtifact created after successful generation

- GIVEN a README artifact is stored in MinIO at 15KB
- WHEN the generation job completes
- THEN a `DocArtifact` row is inserted with `sizeBytes: 15360`
- AND `minioKey` matches the object path
- AND `templateVersion` is recorded

#### Scenario: Idempotency check queries DocArtifact

- GIVEN a `DocArtifact` exists for `(repo-42, abc123, readme, v1)`
- WHEN the idempotency check runs for the same combination
- THEN the check returns `true` (found, skip generation)
- AND no duplicate `DocArtifact` is inserted

### Requirement: Historical Retention

All historical documentation versions SHALL be retained in MinIO and PostgreSQL. No automatic cleanup or TTL SHALL be applied in Phase 1. Retention policy decisions (e.g., keep last N versions, age-based cleanup) SHALL be deferred to Phase 2.

#### Scenario: Multiple versions coexist

- GIVEN README artifacts generated for commit SHAs `abc`, `def`, and `ghi`
- WHEN querying `DocArtifact` for the repository
- THEN three rows are returned, one per commit SHA
- AND all three MinIO objects exist

#### Scenario: No automatic deletion

- GIVEN a repository with 50 historical documentation artifacts
- WHEN 30 days pass with no user action
- THEN all 50 artifacts remain in storage
- AND all 50 `DocArtifact` rows remain in the database

### Requirement: Streaming Download

`GET /api/v1/repositories/:id/docs/:docId/download` SHALL stream the documentation artifact from MinIO to the client. The response SHALL include `Content-Disposition: attachment; filename="{docType}.{format}"` to trigger a browser download. The response SHALL set the appropriate `Content-Type` based on the format (e.g., `text/markdown`, `text/html`, `application/json`).

#### Scenario: Markdown file downloaded with correct headers

- GIVEN a `DocArtifact` with `docType: readme` and `format: md`
- WHEN the download endpoint is called
- THEN the response has `Content-Type: text/markdown`
- AND `Content-Disposition: attachment; filename="readme.md"`
- AND the body is the Markdown content

#### Scenario: Download returns 404 for missing MinIO object

- GIVEN a `DocArtifact` row exists but the MinIO object was deleted externally
- WHEN the download endpoint is called
- THEN a 404 response is returned
- AND the error message indicates the artifact file is missing

## References

- RFC-011 §11 (Storage)
- EPIC-009 §Documentation Engine
