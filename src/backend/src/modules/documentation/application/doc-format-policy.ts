import { DocType } from '../domain/doc-type.enum';
import { DocFormat } from '../domain/doc-format.enum';

/**
 * docType → formats matrix (documentation-formats R1, design decision 2).
 * Each doc type renders into a fixed set of document-level output formats;
 * the renderer registry resolves a `FORMAT_RENDERER` per format.
 */
export const DOC_FORMAT_POLICY: Record<DocType, readonly DocFormat[]> = {
  [DocType.README]: [DocFormat.MARKDOWN, DocFormat.HTML],
  [DocType.ARCHITECTURE_GUIDE]: [DocFormat.MARKDOWN, DocFormat.HTML, DocFormat.MERMAID],
  [DocType.API_REFERENCE]: [DocFormat.MARKDOWN, DocFormat.HTML, DocFormat.OPENAPI, DocFormat.JSON],
  [DocType.MODULE_DOCS]: [DocFormat.MARKDOWN, DocFormat.HTML],
  [DocType.ONBOARDING_GUIDE]: [DocFormat.MARKDOWN, DocFormat.HTML],
};

/** Returns a fresh copy of the formats configured for the given doc type. */
export function resolveFormats(docType: DocType): readonly DocFormat[] {
  return [...DOC_FORMAT_POLICY[docType]];
}
