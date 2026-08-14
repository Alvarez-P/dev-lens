# documentation-views Specification

## Purpose

Define the frontend views for browsing, viewing, and triggering documentation generation. Includes the documentation list page, Markdown viewer, download controls, generation trigger with progress, and navigation integration. Per EPIC-009 §Deliverables.

## Requirements

| #   | Requirement                | Strength |
| --- | -------------------------- | -------- |
| R1  | Documentation list route   | MUST     |
| R2  | Doc type cards             | MUST     |
| R3  | Markdown viewer            | MUST     |
| R4  | Download buttons           | MUST     |
| R5  | Generate button + progress | MUST     |
| R6  | AI-generated badge         | MUST     |
| R7  | Empty state                | MUST     |
| R8  | Navigation integration     | MUST     |

### Requirement: Documentation List Route

The frontend SHALL expose a documentation list page at `/repositories/[id]/docs`. The page SHALL fetch the list of documentation artifacts from `GET /api/v1/repositories/:id/docs` and render them grouped by doc type. The route SHALL be a client-side route within the existing Next.js App Router.

#### Scenario: Navigate to docs from repository detail page

- GIVEN a user viewing the repository detail page at `/repositories/[id]`
- WHEN the user clicks a "Documentation" navigation link
- THEN the browser navigates to `/repositories/[id]/docs`
- AND the docs list API is called
- AND artifacts are displayed grouped by doc type

#### Scenario: Docs page renders loading state

- GIVEN the docs list API is slow to respond
- WHEN the `/repositories/[id]/docs` page mounts
- THEN a loading skeleton is displayed
- AND the skeleton is replaced with content when the API responds

### Requirement: Doc Type Cards

The documentation list page SHALL display one card per doc type (`readme`, `architecture-guide`, `api-reference`, `module-docs`, `onboarding-guide`). Each card SHALL show: the doc type name as a human-readable title (e.g., "README", "Architecture Guide"), the last generated date, and badges for each available format (e.g., "Markdown", "HTML", "OpenAPI").

#### Scenario: Card displays last generated date and format badges

- GIVEN a README artifact was generated on 2026-08-10 in Markdown and HTML formats
- WHEN the docs list page renders
- THEN the README card shows "Aug 10, 2026" as the last generated date
- AND badges for "Markdown" and "HTML" are displayed

#### Scenario: Card for doc type with no artifacts shows "Never generated"

- GIVEN no API Reference has ever been generated for this repository
- WHEN the docs list page renders
- THEN the API Reference card shows "Never generated" instead of a date
- AND no format badges are displayed

### Requirement: Markdown Viewer

Clicking a Markdown artifact on a doc type card SHALL open an inline Markdown viewer. The viewer SHALL render GitHub-flavored Markdown with syntax-highlighted code blocks, Mermaid diagram rendering (via a client-side Mermaid library), and responsive layout. The viewer SHALL fetch the raw Markdown content from the download endpoint and render it client-side.

#### Scenario: Markdown rendered with syntax highlighting

- GIVEN a Markdown artifact containing a TypeScript code block
- WHEN the Markdown viewer renders it
- THEN the code block is syntax-highlighted with TypeScript grammar
- AND the highlighting is applied client-side

#### Scenario: Mermaid diagram renders in viewer

- GIVEN a Markdown artifact containing a ` ```mermaid` fenced code block
- WHEN the Markdown viewer renders it
- THEN the Mermaid library processes the block
- AND a rendered diagram is displayed inline

#### Scenario: Responsive layout adapts to screen width

- GIVEN a mobile viewport width of 375px
- WHEN the Markdown viewer renders
- THEN content is readable without horizontal scrolling
- AND tables are horizontally scrollable within their container

### Requirement: Download Buttons

Each doc type card SHALL provide one download button per available format. Clicking a download button SHALL call `GET /api/v1/repositories/:id/docs/:docId/download` and trigger a browser file download. The button SHALL be labeled with the format name (e.g., "Download Markdown", "Download HTML").

#### Scenario: Download Markdown artifact

- GIVEN a README artifact in Markdown format
- WHEN the user clicks the "Download Markdown" button
- THEN the browser initiates a file download
- AND the downloaded file is named `readme.md`

#### Scenario: Download button disabled while generation in progress

- GIVEN a doc type for which generation is currently running
- WHEN the docs page renders
- THEN the download button for that doc type is disabled with a spinner
- AND a tooltip reads "Generation in progress"

### Requirement: Generate Button and Progress

The documentation list page SHALL include a "Generate Documentation" button. Clicking it SHALL call `POST /api/v1/repositories/:id/docs/generate` and display generation progress. Progress SHALL be obtained by polling the job status or by subscribing to SSE events from the backend. The progress indicator SHALL show the current pipeline stage and a percentage.

#### Scenario: Generate button triggers generation and shows progress

- GIVEN a user clicks "Generate Documentation"
- WHEN the API returns a job ID
- THEN the button is replaced with a progress indicator
- AND the progress bar updates as the job progresses through stages
- AND when completed, the artifact list refreshes with the new artifacts

#### Scenario: Generate button disabled when generation already in progress

- GIVEN a generation job is already running
- WHEN the user visits the docs page
- THEN the "Generate Documentation" button is disabled
- AND a progress indicator shows the current job's status

### Requirement: AI-Generated Badge

Any section of the rendered documentation that was produced via AI enrichment SHALL display an "AI-generated" badge. The badge SHALL be a small, non-intrusive label adjacent to the section heading. The badge SHALL be visually distinct from the "Generated by DevLens" footer.

#### Scenario: AI-enriched section shows badge

- GIVEN a module-docs artifact where the "Overview" section was AI-enriched
- WHEN the Markdown viewer renders the artifact
- THEN an "AI-generated" badge appears next to the "Overview" heading

#### Scenario: Deterministic section does not show badge

- GIVEN a readme artifact where all sections are deterministically generated
- WHEN the Markdown viewer renders the artifact
- THEN no "AI-generated" badge appears on any section

### Requirement: Empty State

When no documentation has been generated for a repository, the documentation list page SHALL display an empty state with the message "No documentation generated yet" and a prominent "Generate Documentation" call-to-action button. The empty state SHALL include a brief explanation of what the Documentation Engine provides.

#### Scenario: Empty state displayed for first visit

- GIVEN a repository with no documentation artifacts
- WHEN the user navigates to `/repositories/[id]/docs`
- THEN the empty state message and CTA button are displayed
- AND the API returns an empty array (not an error)

### Requirement: Navigation Integration

The repository detail page (`/repositories/[id]`) SHALL include a "Documentation" link in the navigation area. The link SHALL be placed alongside existing navigation items (e.g., "API Endpoints", "Graph Viewer"). The link SHALL navigate to `/repositories/[id]/docs`.

#### Scenario: Documentation link visible on repo detail page

- GIVEN a user viewing the repository detail page
- WHEN the page renders
- THEN a "Documentation" navigation link is visible
- AND clicking it navigates to `/repositories/[id]/docs`

#### Scenario: Active state on documentation page

- GIVEN the user is on `/repositories/[id]/docs`
- WHEN the navigation renders
- THEN the "Documentation" link is visually highlighted as active

## References

- EPIC-009 §Documentation Engine
- RFC-011 §6 (Documentation Types)
