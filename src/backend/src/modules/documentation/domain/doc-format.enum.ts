/**
 * Document-level output formats, used as the FORMAT_RENDERER registry keys
 * and as the `format` of stored DocArtifacts (documentation-formats R1).
 * Section-level formats (table, list, mermaid, plantuml, markdown, json) are
 * `SectionFormat` in `domain/doc-template.ts` and are rendered as Markdown
 * fragments inside the renderers.
 */
export enum DocFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  OPENAPI = 'openapi',
  MERMAID = 'mermaid',
  PLANTUML = 'plantuml',
  JSON = 'json',
}
