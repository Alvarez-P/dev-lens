import { DocFormat } from '../../domain/doc-format.enum';

/**
 * File metadata for the download endpoint (api R4, storage R6). The values
 * mirror the renderer `ext` / `contentType` outputs (RenderedArtifact) so a
 * downloaded artifact is byte-identical to the stored object's presentation:
 * `markdown → .md / text/markdown`, `openapi → .openapi.json / application/json`,
 * etc. DocArtifact does not persist the rendered content type, so the download
 * endpoint derives it from the stored `format`.
 */

const FORMAT_FILE_EXT: Record<DocFormat, string> = {
  [DocFormat.MARKDOWN]: 'md',
  [DocFormat.HTML]: 'html',
  [DocFormat.OPENAPI]: 'openapi.json',
  [DocFormat.MERMAID]: 'mmd',
  [DocFormat.PLANTUML]: 'puml',
  [DocFormat.JSON]: 'json',
};

const FORMAT_CONTENT_TYPE: Record<DocFormat, string> = {
  [DocFormat.MARKDOWN]: 'text/markdown',
  [DocFormat.HTML]: 'text/html',
  [DocFormat.OPENAPI]: 'application/json',
  [DocFormat.MERMAID]: 'text/vnd.mermaid',
  [DocFormat.PLANTUML]: 'text/plain',
  [DocFormat.JSON]: 'application/json',
};

/** File extension for a document format (e.g. `md`, `openapi.json`). */
export function fileExtForFormat(format: DocFormat): string {
  return FORMAT_FILE_EXT[format];
}

/** HTTP content type for a document format (storage R6 scenario). */
export function contentTypeForFormat(format: DocFormat): string {
  return FORMAT_CONTENT_TYPE[format];
}

/** Attachment filename: `{docType}.{ext}` (api R4 scenario, storage R6). */
export function downloadFilename(docType: string, format: DocFormat): string {
  return `${docType}.${fileExtForFormat(format)}`;
}
