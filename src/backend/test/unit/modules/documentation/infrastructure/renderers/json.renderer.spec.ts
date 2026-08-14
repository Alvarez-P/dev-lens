import { JsonRenderer } from '@/modules/documentation/infrastructure/renderers/json.renderer';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

/**
 * Task 2.6 (PR1) — JsonRenderer (documentation-formats R7). Full structured
 * dump as JSON: all section data unchanged, plus metadata (docType,
 * generatedAt/timestamp, commitSha). No formatting transformations beyond
 * JSON serialization.
 */
describe('JsonRenderer — full structured dump', () => {
  let renderer: JsonRenderer;

  beforeEach(() => {
    renderer = new JsonRenderer();
  });

  it('should serialize the full document with sections and metadata', () => {
    const doc: GeneratedDocument = {
      docType: DocType.API_REFERENCE,
      templateVersion: '1',
      title: 'API Reference',
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [
        {
          id: 'endpoints',
          title: 'Endpoints',
          format: SectionFormat.TABLE,
          content: {
            columns: ['method', 'path'],
            rows: [
              { method: 'GET', path: '/users' },
              { method: 'POST', path: '/users' },
            ],
          },
        },
        {
          id: 'model',
          title: 'Domain Model',
          format: SectionFormat.MERMAID_CLASS_DIAGRAM,
          content: {
            entities: [{ name: 'User', attributes: ['id'], methods: [] }],
            relationships: [],
          },
        },
      ],
    };

    const artifact = renderer.render(doc);
    const parsed = JSON.parse(artifact.buffer.toString('utf8'));

    expect(artifact.format).toBe(DocFormat.JSON);
    expect(artifact.ext).toBe('json');
    expect(parsed.docType).toBe('api-reference');
    expect(parsed.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(parsed.commitSha).toBe('abc123');
    expect(parsed.templateVersion).toBe('1');

    // All sections preserved with original structure.
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].content.rows).toEqual([
      { method: 'GET', path: '/users' },
      { method: 'POST', path: '/users' },
    ]);
    expect(parsed.sections[1].content.entities[0].name).toBe('User');
  });

  it('should include AI-generated flags and relations metadata unchanged', () => {
    const doc: GeneratedDocument = {
      docType: DocType.MODULE_DOCS,
      templateVersion: '1',
      title: 'Module Docs',
      repositoryId: 'repo-1',
      commitSha: 'def456',
      generatedAt: '2026-02-01T00:00:00.000Z',
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          format: SectionFormat.MARKDOWN,
          aiGenerated: true,
          content: { markdown: 'AI summary' },
        },
      ],
    };

    const parsed = JSON.parse(renderer.render(doc).buffer.toString('utf8'));
    expect(parsed.commitSha).toBe('def456');
    expect(parsed.sections[0].aiGenerated).toBe(true);
    expect(parsed.sections[0].content.markdown).toBe('AI summary');
  });
});
