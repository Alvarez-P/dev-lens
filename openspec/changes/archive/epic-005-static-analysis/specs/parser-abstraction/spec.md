# Parser Abstraction Specification

## Purpose

Define the `LanguageParser` interface and `ParserRegistry` strategy pattern that decouple the analysis pipeline from language-specific parser implementations. Per RFC-006 §6, every language implements its own parser, but the pipeline operates against this abstraction.

## Requirements

### Requirement: LanguageParser Interface Contract

The system SHALL define a `LanguageParser` interface with a single `parse` method accepting a `ParsedFile` input and returning a `ParseResult`. All language parsers MUST implement this interface.

| Method        | Input                                  | Output                                     |
| ------------- | -------------------------------------- | ------------------------------------------ |
| `parse(file)` | `ParsedFile` (path, content, language) | `ParseResult` (ast, diagnostics, filePath) |

#### Scenario: Parser invoked by pipeline

- GIVEN a registered TypeScript parser and a `.ts` file
- WHEN the pipeline calls `parser.parse(file)`
- THEN a `ParseResult` containing the file's AST and an empty diagnostics list is returned

#### Scenario: Parse failure produces diagnostics

- GIVEN a file with syntax errors
- WHEN `parser.parse(file)` is called
- THEN the `ParseResult` contains `diagnostics` describing each error
- AND no exception is thrown — errors are returned, not raised

### Requirement: ParserRegistry Strategy Pattern

The system SHALL provide a `ParserRegistry` that maps language identifiers to `LanguageParser` instances. Parsers MUST be registered before use. Lookup for an unregistered language SHALL throw a descriptive error.

#### Scenario: Registered parser found

- GIVEN `ParserRegistry` with `typescript → TypeScriptParser`
- WHEN `registry.get('typescript')` is called
- THEN the `TypeScriptParser` instance is returned

#### Scenario: Unregistered language throws

- GIVEN `ParserRegistry` with no `go` parser
- WHEN `registry.get('go')` is called
- THEN an error is thrown with message indicating `go` is unsupported

### Requirement: ParseResult Contract

Every `ParseResult` SHALL include: `filePath` (absolute), `language` (string), `ast` (language-specific tree, or null on failure), and `diagnostics` (array, empty on success). The contract MUST be identical across all parser implementations.

#### Scenario: Successful parse result

- GIVEN a valid source file
- WHEN parsing completes without errors
- THEN `parseResult.ast` is not null and `parseResult.diagnostics` is empty

#### Scenario: Failed parse result

- GIVEN a syntactically invalid source file
- WHEN parsing completes with errors
- THEN `parseResult.ast` is null and `parseResult.diagnostics` contains at least one entry with `severity`, `message`, and `line`

## References

- RFC-006 §6 (Responsibilities), §11 (Language Independence)
- EPIC-005 §2.3 (Source Code Parsing)
