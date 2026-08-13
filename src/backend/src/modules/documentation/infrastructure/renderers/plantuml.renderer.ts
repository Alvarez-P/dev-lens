import { DocFormat } from '../../domain/doc-format.enum';
import { GeneratedDocument, DiagramEntity, DiagramRelationship } from '../../domain/doc-document';
import { IDocFormatRenderer, RenderedArtifact } from './renderer.interface';

/** PlantUML relationship arrows per kind (documentation-formats R6). */
const RELATIONSHIP_ARROWS: Record<DiagramRelationship['kind'], string> = {
  inheritance: '<|--',
  composition: '*--',
  aggregation: 'o--',
  association: '--',
};

function escapeName(name: string): string {
  return name.replace(/[^\w]/g, '_');
}

/**
 * Pure PlantUML class-diagram text builder (documentation-formats R6).
 * Output begins with `@startuml` and ends with `@enduml`; entities are
 * PlantUML classes with attributes and methods; relationships use PlantUML
 * arrow syntax.
 */
export function renderPlantUmlClassDiagram(
  entities: DiagramEntity[],
  relationships: DiagramRelationship[],
): string {
  const lines = ['@startuml'];

  for (const entity of entities) {
    lines.push(`class ${escapeName(entity.name)} {`);
    for (const attribute of entity.attributes) {
      lines.push(`    +${attribute}`);
    }
    for (const method of entity.methods) {
      lines.push(`    +${method}()`);
    }
    lines.push('}');
  }

  for (const relationship of relationships) {
    const arrow = RELATIONSHIP_ARROWS[relationship.kind] ?? '--';
    const label = relationship.label ? ` : ${relationship.label}` : '';
    lines.push(`${escapeName(relationship.from)} ${arrow} ${escapeName(relationship.to)}${label}`);
  }

  lines.push('@enduml');
  return lines.join('\n');
}

/**
 * PlantUMLRenderer (documentation-formats R6) — document-level `plantuml`
 * format. Produces a single PlantUML diagram document from the document's
 * plantuml sections.
 */
export class PlantUMLRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.PLANTUML;

  render(doc: GeneratedDocument): RenderedArtifact {
    const diagrams = doc.sections
      .filter((section) => section.format === 'plantuml')
      .map((section) => {
        const content = section.content as {
          entities: DiagramEntity[];
          relationships: DiagramRelationship[];
        };
        return renderPlantUmlClassDiagram(content.entities, content.relationships);
      });

    return {
      format: DocFormat.PLANTUML,
      contentType: 'text/plain',
      ext: 'puml',
      buffer: Buffer.from(diagrams.join('\n\n'), 'utf8'),
    };
  }
}
