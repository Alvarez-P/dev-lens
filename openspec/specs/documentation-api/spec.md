# documentation-api Specification

## Purpose

Define the REST API for documentation generation, listing, retrieval, download, deletion, and forced regeneration. All endpoints are authenticated and scoped to repository membership. Per RFC-011 §13.

## Requirements

| #   | Requirement           | Strength |
| --- | --------------------- | -------- |
| R1  | Generate endpoint     | MUST     |
| R2  | List endpoint         | MUST     |
| R3  | Get metadata endpoint | MUST     |
| R4  | Download endpoint     | MUST     |
| R5  | Delete endpoint       | MUST     |
| R6  | Regenerate endpoint   | MUST     |
| R7  | Auth guard on all     | MUST     |

### Requirement: Generate Endpoint

`POST /api/v1/repositories/:id/docs/generate` SHALL enqueue a BullMQ generation job and return the job ID. The optional request body SHALL accept `docTypes` (array of strings) to limit generation to specific types. If `docTypes` is omitted, all applicable types SHALL be generated. The response SHALL include `jobId` for status polling.

#### Scenario: Generate all doc types

- GIVEN an authenticated member of repository R
- WHEN `POST /api/v1/repositories/R/docs/generate` is called
- THEN a 202 Accepted response is returned with `{ "jobId": "..." }`
- AND the BullMQ job is enqueued for all doc types

#### Scenario: Generate specific doc types

- GIVEN an authenticated member of repository R
- WHEN `POST /api/v1/repositories/R/docs/generate` is called with `{ "docTypes": ["readme", "api-reference"] }`
- THEN only readme and api-reference jobs are enqueued
- AND the response includes the job ID

#### Scenario: Invalid doc type returns 400

- GIVEN an authenticated member of repository R
- WHEN `POST /api/v1/repositories/R/docs/generate` is called with `{ "docTypes": ["nonexistent"] }`
- THEN a 400 Bad Request is returned
- AND the error message indicates the invalid doc type

### Requirement: List Endpoint

`GET /api/v1/repositories/:id/docs` SHALL return all `DocArtifact` records for the repository, ordered by `generatedAt` descending. The response SHALL include `id`, `docType`, `format`, `sizeBytes`, `generatedAt`, `templateVersion`, and `commitSha` for each artifact. Artifacts with the same `(docType, format)` and different `commitSha` SHALL all be returned (historical versions).

#### Scenario: List all artifacts for a repository

- GIVEN a repository with 3 README artifacts at different commits and 2 API Reference artifacts
- WHEN `GET /api/v1/repositories/:id/docs` is called
- THEN 5 artifacts are returned
- AND they are ordered by `generatedAt` descending

#### Scenario: Repository with no docs returns empty array

- GIVEN a repository that has never had documentation generated
- WHEN `GET /api/v1/repositories/:id/docs` is called
- THEN an empty array `[]` is returned

### Requirement: Get Metadata Endpoint

`GET /api/v1/repositories/:id/docs/:docId` SHALL return the full `DocArtifact` metadata for a specific artifact, including a presigned download URL generated from MinIO. The presigned URL SHALL have a 1-hour expiry. If the artifact does not exist, a 404 SHALL be returned.

#### Scenario: Get artifact metadata with download URL

- GIVEN a `DocArtifact` with id `doc-123` exists
- WHEN `GET /api/v1/repositories/R/docs/doc-123` is called
- THEN the response includes all metadata fields
- AND a `downloadUrl` field contains a presigned MinIO URL
- AND the URL expires in 1 hour

#### Scenario: Non-existent artifact returns 404

- GIVEN no `DocArtifact` with id `doc-999` exists
- WHEN `GET /api/v1/repositories/R/docs/doc-999` is called
- THEN a 404 response is returned

### Requirement: Download Endpoint

`GET /api/v1/repositories/:id/docs/:docId/download` SHALL stream the artifact file from MinIO directly to the client. The response SHALL set `Content-Disposition: attachment` with the artifact's filename and an appropriate `Content-Type` header. This endpoint SHALL NOT require a presigned URL — it SHALL read from MinIO server-side and pipe to the response.

#### Scenario: Stream artifact file to client

- GIVEN a `DocArtifact` for a Markdown README
- WHEN `GET /api/v1/repositories/R/docs/doc-123/download` is called
- THEN the response body is the raw file content
- AND `Content-Type` is `text/markdown`
- AND `Content-Disposition` includes `filename="readme.md"`

### Requirement: Delete Endpoint

`DELETE /api/v1/repositories/:id/docs/:docId` SHALL delete the specified `DocArtifact` from PostgreSQL and its corresponding object from MinIO. This endpoint SHALL be restricted to repository owners and admins. The operation SHALL be atomic — if MinIO deletion fails, the `DocArtifact` SHALL remain in the database. If the artifact does not exist, a 404 SHALL be returned.

#### Scenario: Owner deletes an artifact

- GIVEN the authenticated user is the repository owner
- AND a `DocArtifact` with id `doc-123` exists
- WHEN `DELETE /api/v1/repositories/R/docs/doc-123` is called
- THEN the MinIO object is deleted
- AND the `DocArtifact` row is removed
- AND a 204 No Content response is returned

#### Scenario: Non-owner receives 403

- GIVEN the authenticated user is a repository member but not owner
- WHEN `DELETE /api/v1/repositories/R/docs/doc-123` is called
- THEN a 403 Forbidden response is returned
- AND no data is modified

### Requirement: Regenerate Endpoint

`POST /api/v1/repositories/:id/docs/regenerate` SHALL force regeneration of documentation even if idempotency checks would normally skip it. The endpoint SHALL accept the same `docTypes` body parameter as the generate endpoint. Regeneration SHALL bypass the commit SHA + template version idempotency check and always produce new artifacts.

#### Scenario: Force regenerate bypasses idempotency

- GIVEN a `DocArtifact` already exists for repo R, commit `abc123`, doc type `readme`, template v1
- WHEN `POST /api/v1/repositories/R/docs/regenerate` is called
- THEN generation proceeds even though an artifact already exists
- AND a new `DocArtifact` is created (potentially overwriting the latest pointer)

#### Scenario: Regenerate specific types

- GIVEN a repository with existing README and API Reference artifacts
- WHEN `POST /api/v1/repositories/R/docs/regenerate` is called with `{ "docTypes": ["readme"] }`
- THEN only the README is regenerated
- AND the API Reference artifact is left unchanged

### Requirement: Auth Guard on All Endpoints

Every documentation API endpoint SHALL be protected by JWT authentication and repository membership. The guard implementation SHALL follow the existing `JwtAuthGuard` + `RepoMembershipGuard` pattern. Unauthenticated requests SHALL return 401; authenticated non-members SHALL return 403.

#### Scenario: Unauthenticated request returns 401

- GIVEN no JWT token in the request
- WHEN accessing any `/api/v1/repositories/:id/docs` endpoint
- THEN a 401 Unauthorized response is returned

#### Scenario: Non-member returns 403

- GIVEN a user authenticated but not a member of repository R
- WHEN accessing any `/api/v1/repositories/R/docs` endpoint
- THEN a 403 Forbidden response is returned

#### Scenario: Authenticated member accesses successfully

- GIVEN a user authenticated via JWT who is a member of repository R
- WHEN accessing any `/api/v1/repositories/R/docs` endpoint
- THEN the request proceeds to the endpoint handler

## References

- RFC-011 §13 (Integration Points)
- EPIC-009 §Documentation Engine
