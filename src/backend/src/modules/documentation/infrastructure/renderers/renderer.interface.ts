import { DocFormat } from '../../domain/doc-format.enum';
import { GeneratedDocument } from '../../domain/doc-document';

/** Output of one document-level format renderer (design: RenderedArtifact). */
export interface RenderedArtifact {
  format: DocFormat;
  contentType: string;
  ext: string;
  buffer: Buffer;
}

/**
 * Contract for document-level format renderers (documentation-formats R1).
 * Each renderer is registered behind the FORMAT_RENDERER token (assembled into
 * an array by a factory provider) and resolved by its `format` key; adding a
 * renderer requires zero changes to existing renderers or the registry.
 */
export interface IDocFormatRenderer {
  readonly format: DocFormat;
  render(doc: GeneratedDocument): RenderedArtifact;
}
