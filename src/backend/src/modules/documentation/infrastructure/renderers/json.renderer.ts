import { DocFormat } from '../../domain/doc-format.enum';
import { GeneratedDocument } from '../../domain/doc-document';
import { IDocFormatRenderer, RenderedArtifact } from './renderer.interface';

/**
 * JsonRenderer (documentation-formats R7) — document-level `json` format.
 * Produces a machine-readable dump of the full structured documentation data:
 * every section with its original content, plus metadata (docType, commitSha,
 * generatedAt, templateVersion). No transformations beyond JSON serialization.
 */
export class JsonRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.JSON;

  render(doc: GeneratedDocument): RenderedArtifact {
    const dump = {
      docType: doc.docType,
      templateVersion: doc.templateVersion,
      title: doc.title,
      repositoryId: doc.repositoryId,
      commitSha: doc.commitSha,
      generatedAt: doc.generatedAt,
      sections: doc.sections,
    };

    return {
      format: DocFormat.JSON,
      contentType: 'application/json',
      ext: 'json',
      buffer: Buffer.from(JSON.stringify(dump, null, 2), 'utf8'),
    };
  }
}
