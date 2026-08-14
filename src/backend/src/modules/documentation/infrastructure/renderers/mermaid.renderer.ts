import { DocFormat } from '../../domain/doc-format.enum';
import {
  GeneratedDocument,
  DiagramEntity,
  DiagramRelationship,
  FlowNode,
  FlowEdge,
} from '../../domain/doc-document';
import { IDocFormatRenderer, RenderedArtifact } from './renderer.interface';

/** Mermaid arrow per relationship kind (documentation-formats R5). */
const CLASS_ARROWS: Record<DiagramRelationship['kind'], string> = {
  inheritance: '<|--',
  composition: '*--',
  aggregation: 'o--',
  association: '--',
};

function escapeName(name: string): string {
  return name.replace(/[^\w]/g, '_');
}

/**
 * Pure class-diagram text builder (documentation-formats R5). Entities become
 * Mermaid classes with attributes and methods; relationships become arrows.
 */
export function renderClassDiagram(
  entities: DiagramEntity[],
  relationships: DiagramRelationship[],
): string {
  const lines = ['classDiagram'];

  for (const entity of entities) {
    lines.push(`    class ${escapeName(entity.name)} {`);
    for (const attribute of entity.attributes) {
      lines.push(`        +${attribute}`);
    }
    for (const method of entity.methods) {
      lines.push(`        +${method}()`);
    }
    lines.push('    }');
  }

  for (const relationship of relationships) {
    const arrow = CLASS_ARROWS[relationship.kind] ?? '--';
    const label = relationship.label ? ` : ${relationship.label}` : '';
    lines.push(
      `    ${escapeName(relationship.from)} ${arrow} ${escapeName(relationship.to)}${label}`,
    );
  }

  return lines.join('\n');
}

/**
 * Pure flowchart text builder (documentation-formats R5). Nodes become
 * flowchart nodes; edges become directed arrows with optional labels.
 */
export function renderFlowchart(nodes: FlowNode[], edges: FlowEdge[]): string {
  const lines = ['flowchart LR'];

  for (const node of nodes) {
    const label = node.label ? `["${node.label}"]` : '';
    lines.push(`    ${escapeName(node.id)}${label}`);
  }

  for (const edge of edges) {
    const label = edge.label ? `|${edge.label}|` : '';
    lines.push(`    ${escapeName(edge.from)} -->${label} ${escapeName(edge.to)}`);
  }

  return lines.join('\n');
}

/**
 * MermaidRenderer (documentation-formats R5) — document-level `mermaid`
 * format. Produces valid Mermaid diagram text from the document's diagram
 * sections.
 */
export class MermaidRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.MERMAID;

  render(doc: GeneratedDocument): RenderedArtifact {
    const text = doc.sections
      .map((section) => {
        if (section.format === 'mermaid-class-diagram') {
          const content = section.content as {
            entities: DiagramEntity[];
            relationships: DiagramRelationship[];
          };
          return renderClassDiagram(content.entities, content.relationships);
        }
        if (section.format === 'mermaid-flowchart') {
          const content = section.content as { nodes: FlowNode[]; edges: FlowEdge[] };
          return renderFlowchart(content.nodes, content.edges);
        }
        return null;
      })
      .filter((part): part is string => part !== null)
      .join('\n\n');

    return {
      format: DocFormat.MERMAID,
      contentType: 'text/vnd.mermaid',
      ext: 'mmd',
      buffer: Buffer.from(text, 'utf8'),
    };
  }
}
