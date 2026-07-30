/**
 * Repository status lifecycle:
 *   ACTIVE   — Ready to sync
 *   CLONING  — Initial clone in progress
 *   SYNCING  — Sync/pull in progress
 *   ERROR    — Last operation failed
 *   ARCHIVED — Archived (no longer synced)
 */
export enum RepositoryStatus {
  ACTIVE = 'ACTIVE',
  CLONING = 'CLONING',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
  ARCHIVED = 'ARCHIVED',
}
