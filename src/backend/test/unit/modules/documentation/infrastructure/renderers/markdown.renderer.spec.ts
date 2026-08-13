import { MarkdownRenderer } from '@/modules/documentation/infrastructure/renderers/markdown.renderer';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

/**
 * Task 2.1 (PR1) — MarkdownRenderer (documentation-formats R2). Section
 * fragments: table → GFM table, list → bullets, mermaid-class-diagram /
 * mermaid-flowchart → ```mermaid fences, plantuml → ```plantuml fences,
 * markdown → raw pass-through, section title → `##` heading.
 */
describe('MarkdownRenderer — section fragment rendering', () => {
  let renderer: MarkdownRenderer;

  beforeEach(() => {
    renderer = new MarkdownRenderer();
  });

  it('should render a table section as a GFM table with a ## title', () => {
    const doc: GeneratedDocument = {
      docType: DocType.README,
      templateVersion: '1',
      title: 'README',
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
      ],
    };

    const artifact = renderer.render(doc);
    const markdown = artifact.buffer.toString('utf8');

    expect(artifact.format).toBe(DocFormat.MARKDOWN);
    expect(markdown).toContain('## Endpoints');
    expect(markdown).toContain('| method | path |');
    expect(markdown).toContain('| GET | /users |');
    expect(markdown).toContain('| POST | /users |');
    expect(markdown).toMatch(/\| ---- \| ---- \|/);
  });

  it('should derive column headers from the data keys when columns are absent', () => {
    const doc: GeneratedDocument = {
      docType: DocType.API_REFERENCE,
      templateVersion: '1',
      title: 'API',
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [
        {
          id: 'users',
          title: 'Users',
          format: SectionFormat.TABLE,
          content: {
            rows: [{ name: 'alice', role: 'admin' }],
          },
        },
      ],
    };

    const markdown = renderer.render(doc).buffer.toString('utf8');
    expect(markdown).toContain('| name | role |');
    expect(markdown).toContain('| alice | admin |');
  });

  it('should render a list section as bulleted items', () => {
    const doc: GeneratedDocument = {
      docType: DocType.README,
      templateVersion: '1',
      title: 'README',
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [
        {
          id: 'stack',
          title: 'Tech Stack',
          format: SectionFormat.LIST,
          content: { items: ['NestJS', 'PostgreSQL', 'MinIO'] },
        },
      ],
    };

    const markdown = renderer.render(doc).buffer.toString('utf8');
    expect(markdown).toContain('## Tech Stack');
    expect(markdown).toContain('- NestJS');
    expect(markdown).toContain('- PostgreSQL');
    expect(markdown).toContain('- MinIO');
  });

  it('should render a mermaid-class-diagram section inside ```mermaid fences', () => {
    const doc: GeneratedDocument = {
      docType: DocType.ARCHITECTURE_GUIDE,
      templateVersion: '1',
      title: 'Architecture',
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [
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

    const markdown = renderer.render(doc).buffer.toString('utf8');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toMatch(/```mermaid\nclassDiagram\n/);
    expect(markdown).toContain('```');
  });

  it('should render a plantuml section inside ```plantuml fences', () => {
    const doc: GeneratedDocument = {
      docType: DocType.ARCHITECTURE_GUIDE,
      templateVersion: '1',
      title: 'Architecture',
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [
        {
          id: 'model',
          title: 'Domain Model',
          format: SectionFormat.PLANTUML,
          content: {
            entities: [{ name: 'User', attributes: ['id'], methods: [] }],
            relationships: [],
          },
        },
      ],
    };

    const markdown = renderer.render(doc).buffer.toString('utf8');
    expect(markdown).toContain('```plantuml');
    expect(markdown).toMatch(/```plantuml\n@startuml\n/);
    expect(markdown).toContain('```');
  });

  it('should pass raw markdown sections through unchanged', () => {
    const raw = 'Some *raw* **markdown** content.';
    const doc: GeneratedDocument = {
      docType: DocType.README,
      templateVersion: '1',
      title: 'README',
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [
        {
          id: 'intro',
          title: 'Intro',
          format: SectionFormat.MARKDOWN,
          content: { markdown: raw },
        },
      ],
    };

    const markdown = renderer.render(doc).buffer.toString('utf8');
    expect(markdown).toContain(raw);
  });
});
