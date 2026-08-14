import {
  MermaidRenderer,
  renderClassDiagram,
  renderFlowchart,
} from '@/modules/documentation/infrastructure/renderers/mermaid.renderer';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

/**
 * Task 2.4 (PR1) — MermaidRenderer (documentation-formats R5). Class diagrams:
 * entities become classes with attributes and methods, relationships become
 * arrows. Flowcharts: nodes become nodes, dependencies become directed edges
 * with labels.
 */
describe('renderClassDiagram — classDiagram text', () => {
  it('should begin with classDiagram and render entities with attributes and methods', () => {
    const text = renderClassDiagram(
      [
        { name: 'User', attributes: ['id: string', 'name: string'], methods: ['getName'] },
        { name: 'Admin', attributes: ['role: string'], methods: [] },
      ],
      [],
    );

    expect(text).toMatch(/^classDiagram/);
    expect(text).toContain('class User {');
    expect(text).toContain('+id: string');
    expect(text).toContain('+getName()');
    expect(text).toContain('class Admin {');
  });

  it('should render inheritance and composition relationships as arrows', () => {
    const text = renderClassDiagram(
      [{ name: 'User', attributes: [], methods: [] }],
      [
        { from: 'Admin', to: 'User', kind: 'inheritance' },
        { from: 'Profile', to: 'User', kind: 'composition' },
        { from: 'Team', to: 'User', kind: 'aggregation', label: 'members' },
      ],
    );

    expect(text).toContain('Admin <|-- User');
    expect(text).toContain('Profile *-- User');
    expect(text).toContain('Team o-- User : members');
  });
});

describe('renderFlowchart — flowchart text', () => {
  it('should render nodes and directed edges with labels', () => {
    const text = renderFlowchart(
      [
        { id: 'auth', label: 'AuthModule' },
        { id: 'users', label: 'UsersModule' },
      ],
      [{ from: 'auth', to: 'users', label: 'imports' }],
    );

    expect(text).toMatch(/^flowchart/);
    expect(text).toContain('auth["AuthModule"]');
    expect(text).toContain('users["UsersModule"]');
    expect(text).toContain('auth -->|imports| users');
  });
});

describe('MermaidRenderer — document-level mermaid format', () => {
  let renderer: MermaidRenderer;

  beforeEach(() => {
    renderer = new MermaidRenderer();
  });

  it('should produce a mermaid artifact from the doc diagram sections', () => {
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

    const artifact = renderer.render(doc);

    expect(artifact.format).toBe(DocFormat.MERMAID);
    expect(artifact.ext).toBe('mmd');
    expect(artifact.buffer.toString('utf8')).toMatch(/^classDiagram/);
  });
});
