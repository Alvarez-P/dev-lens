import {
  PlantUMLRenderer,
  renderPlantUmlClassDiagram,
} from '@/modules/documentation/infrastructure/renderers/plantuml.renderer';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

/**
 * Task 2.5 (PR1) — PlantUMLRenderer (documentation-formats R6). Output begins
 * with `@startuml` and ends with `@enduml`; entities are PlantUML classes,
 * relationships use PlantUML arrow syntax.
 */
describe('renderPlantUmlClassDiagram — @startuml…@enduml', () => {
  it('should wrap output in @startuml/@enduml and render entities as classes', () => {
    const text = renderPlantUmlClassDiagram(
      [{ name: 'User', attributes: ['id: string'], methods: ['getName'] }],
      [],
    );

    expect(text).toMatch(/^@startuml/);
    expect(text).toMatch(/@enduml$/);
    expect(text).toContain('class User {');
    expect(text).toContain('+id: string');
    expect(text).toContain('+getName()');
  });

  it('should render relationships with PlantUML arrow syntax', () => {
    const text = renderPlantUmlClassDiagram(
      [{ name: 'User', attributes: [], methods: [] }],
      [
        { from: 'Admin', to: 'User', kind: 'inheritance' },
        { from: 'Profile', to: 'User', kind: 'composition' },
      ],
    );

    expect(text).toContain('Admin <|-- User');
    expect(text).toContain('Profile *-- User');
  });
});

describe('PlantUMLRenderer — document-level plantuml format', () => {
  let renderer: PlantUMLRenderer;

  beforeEach(() => {
    renderer = new PlantUMLRenderer();
  });

  it('should produce a plantuml artifact from the doc plantuml sections', () => {
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

    const artifact = renderer.render(doc);

    expect(artifact.format).toBe(DocFormat.PLANTUML);
    expect(artifact.ext).toBe('puml');
    const text = artifact.buffer.toString('utf8');
    expect(text).toMatch(/^@startuml/);
    expect(text).toMatch(/@enduml$/);
  });
});
