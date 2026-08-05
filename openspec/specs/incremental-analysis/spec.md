# Incremental Analysis Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)

## Purpose

Avoid full re-analysis when only a subset of files change. Per RFC-006 §12, incremental analysis detects changed files via content hashing and re-parses only affected portions, merging the result with the previous IR.

## Requirements

### Requirement: Content-Hash File Manifest

The system SHALL build a content-hash manifest per snapshot: `Map<filePath, hash>`. Hashes MUST use SHA-256 computed over file content. The manifest SHALL be persisted alongside the IR for comparison on the next analysis run.

#### Scenario: Manifest built from snapshot

- GIVEN a snapshot with three `.ts` files
- WHEN the manifest is computed
- THEN three entries exist: `path/to/a.ts → sha256`, `path/to/b.ts → sha256`, `path/to/c.ts → sha256`

#### Scenario: Manifest comparison identifies changes

- GIVEN a previous manifest where `a.ts` had hash `AAA`
- AND the current snapshot where `a.ts` now has hash `BBB`
- WHEN manifests are compared
- THEN `a.ts` is identified as changed
- AND unchanged files are excluded from re-parsing

### Requirement: Partial Re-Parse

The system SHALL re-parse only changed, added, and deleted files. Detected changes SHALL trigger IR regeneration for the containing Module and its relationships. Unchanged Modules SHALL be reused from the previous IR.

#### Scenario: One file changed, one module re-built

- GIVEN a previous IR with Modules M1, M2, and M3
- AND the manifest detects only `M2/src/service.ts` has changed
- WHEN incremental analysis runs
- THEN only files in M2 are re-parsed
- AND the new IR reuses M1 and M3 from the previous IR
- AND relationships crossing into/out of M2 are recalculated

#### Scenario: File deleted

- GIVEN a manifest where a file exists in the previous snapshot but not the current one
- WHEN incremental analysis runs
- THEN the file is removed from its Module's IR
- AND any relationships targeting the removed file are dropped

#### Scenario: File added

- GIVEN a manifest where a new file appears that was not in the previous snapshot
- WHEN incremental analysis runs
- THEN the new file is parsed and added to its Module's IR
- AND new relationships are calculated

### Requirement: Full Re-Parse Fallback

If the previous IR is missing or corrupted, or if structural changes exceed a threshold (e.g., >50% of files changed), the system SHALL fall back to full analysis.

#### Scenario: Previous IR missing triggers full re-parse

- GIVEN no previous IR exists for the repository
- WHEN incremental analysis is requested
- THEN the system performs a full analysis
- AND the new IR serves as the baseline for future incremental runs

#### Scenario: Structural change threshold exceeded

- GIVEN a previous IR and a manifest showing >50% of files changed
- WHEN incremental analysis runs
- THEN the system performs a full analysis
- AND a log entry records the fallback reason

### Requirement: Reuse Ratio Metric

The system SHALL report a reuse ratio: `unchangedModules / totalModules`. When incremental analysis completes, the reuse ratio MUST be > 0 (meaning at least one module was reused rather than re-parsed) and SHOULD be included in `analysis.completed` event metadata.

#### Scenario: Reuse ratio reported

- GIVEN 10 modules where 8 are unchanged
- WHEN incremental analysis completes
- THEN the `analysis.completed` event includes `reuseRatio: 0.8`

## References

- RFC-006 §12 (Incremental Analysis), §17 (Observability)
- EPIC-005 §2.6 (Incremental Analysis)
- Proposal: Risks § (Incremental rename/delete mitigation)
