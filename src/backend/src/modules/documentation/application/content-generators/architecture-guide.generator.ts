import { DocType } from '../../domain/doc-type.enum';
import { SectionFormat } from '../../domain/doc-template';
import {
  GeneratedDocument,
  DocSection,
  DocTableContent,
  DocMarkdownContent,
} from '../../domain/doc-document';
import { GraphNode } from '../../../knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '../../../knowledge-graph/domain/graph-edge.vo';
import { IDocContentGenerator, DocContext } from './content-generator.interface';
import {
  buildGeneratedDocument,
  extractEntities,
  extractRelationships,
  extractModules,
  extractDependencyGraph,
  extractEvents,
  hasEvents,
} from './graph-content';

function aiPlaceholder(id: string, title: string): DocSection {
  return {
    id,
    title,
    format: SectionFormat.MARKDOWN,
    content: { markdown: '' } as DocMarkdownContent,
    aiGenerated: false,
  };
}

function moduleTable(id: string, title: string): DocSection {
  const content: DocTableContent = { columns: ['Module', 'FQN'], rows: [] };
  return { id, title, format: SectionFormat.TABLE, content };
}

function eventTable(events: Array<{ name: string; fqn: string }>): DocSection {
  const content: DocTableContent = {
    columns: ['Event', 'FQN'],
    rows: events.map((event) => ({ Event: event.name, FQN: event.fqn })),
  };
  return { id: 'event-catalog', title: 'Event Catalog', format: SectionFormat.TABLE, content };
}

/**
 * Architecture-guide content generator (built-in architecture-guide v1
 * template; template R2/R4). system-overview is an ai.enrich placeholder;
 * container/component/dependency diagrams, bounded-context map and event
 * catalog are extracted from the graph. The event-catalog section is
 * conditional on `has_events` (template R4).
 */
export function generateArchitectureGuideDocument(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  _version: number,
  ctx: DocContext,
): GeneratedDocument {
  const entities = extractEntities(nodes);
  const relationships = extractRelationships(edges, nodes);
  const modules = extractModules(nodes);
  const dependencyFlow = extractDependencyGraph(nodes, edges);

  const sections: DocSection[] = [
    aiPlaceholder('system-overview', 'System Overview'),
    {
      id: 'container-diagram',
      title: 'Container Diagram',
      format: SectionFormat.MERMAID_FLOWCHART,
      content: dependencyFlow,
    },
    {
      id: 'component-diagram',
      title: 'Component Diagram',
      format: SectionFormat.MERMAID_CLASS_DIAGRAM,
      content: { entities, relationships },
    },
    moduleTable('bounded-context-map', 'Bounded Context Map'),
  ];

  // Fill the bounded-context-map rows now that the section exists.
  const boundedContext = sections.find((s) => s.id === 'bounded-context-map')!;
  (boundedContext.content as DocTableContent).rows = modules.map((module) => ({
    Module: module.label,
    FQN: module.fqn,
  }));

  if (hasEvents(nodes)) {
    sections.push(eventTable(extractEvents(nodes)));
  }

  sections.push({
    id: 'dependency-map',
    title: 'Dependency Map',
    format: SectionFormat.MERMAID_FLOWCHART,
    content: dependencyFlow,
  });

  return buildGeneratedDocument(DocType.ARCHITECTURE_GUIDE, ctx, sections);
}

export class ArchitectureGuideContentGenerator implements IDocContentGenerator {
  readonly docType = DocType.ARCHITECTURE_GUIDE;

  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument {
    return generateArchitectureGuideDocument(nodes, edges, version, ctx);
  }
}
