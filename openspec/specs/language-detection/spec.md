# Language Detection Specification

> **Archived from**: `epic-005-static-analysis` (2026-08-04)

## Purpose

Deterministic mapping of file extensions to parser strategies, enabling the pipeline to route files to the correct `LanguageParser` without inspecting file contents. This is the first stage of the analysis pipeline per RFC-006 §5.

## Requirements

### Requirement: Extension-Based Language Mapping

The system SHALL map file extensions to language identifiers using a predefined lookup table. Detection MUST be case-insensitive for extensions. Files with no recognized extension SHALL be skipped with a logged warning — not an error.

#### Scenario: Known TypeScript file detected

- GIVEN a snapshot with `src/controller.ts` and `lib/utils.js`
- WHEN language detection runs
- THEN `.ts` maps to `typescript` and `.js` maps to `javascript`
- AND both files proceed to the parser stage

#### Scenario: Unknown extension skipped

- GIVEN a snapshot with `assets/logo.png` and `data/schema.sql`
- WHEN language detection runs
- THEN both files are excluded from analysis
- AND a warning is logged for each unknown extension

#### Scenario: Mixed-case extension

- GIVEN a file named `Component.TSX`
- WHEN language detection runs
- THEN the extension is normalized and mapped to `typescript`

### Requirement: Multi-Language Snapshot Handling

The system SHALL group detected files by language, producing a `Map<Language, FilePath[]>` structure consumed by the parser stage.

#### Scenario: Multi-language repository

- GIVEN a snapshot containing `.ts`, `.go`, and `.py` files
- WHEN language detection runs
- THEN three groups are produced: `typescript → [...]`, `go → [...]`, `python → [...]`
- AND unrecognized extensions (.md, .json) are excluded

### Requirement: Detection is Deterministic

Given the same set of file paths, the system SHALL produce the same language grouping every time. Extension-to-language mappings MUST NOT rely on external configuration or runtime state.

#### Scenario: Repeated detection yields identical results

- GIVEN the same snapshot file list
- WHEN language detection runs twice
- THEN both outputs are byte-identical

## References

- RFC-006 §5 (Analysis Pipeline), §11 (Language Independence)
- EPIC-005 §2.3 (Source Code Parsing)
