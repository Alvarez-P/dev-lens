/**
 * Lifecycle status of a DocArtifact generation attempt. `skipped` is used
 * when idempotency short-circuits generation for an already-produced
 * `(repositoryId, commitSha, docType, templateVersion)` combination
 * (documentation-generation R4).
 */
export enum DocBuildStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}
