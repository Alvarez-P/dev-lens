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
  extractExports,
  extractEvents,
  hasEvents,
  hasDependencies,
  ExportRow,
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

function publicApiTable(exports: ExportRow[]): DocSection {
  const content: DocTableContent = {
    columns: ['Module', 'Name', 'Type', 'FQN'],
    rows: exports.map((row) => ({
      Module: row.module,
      Name: row.name,
      Type: row.type,
      FQN: row.fqn,
    })),
  };
  return { id: 'public-api', title: 'Public API', format: SectionFormat.TABLE, content };
}

function dependenciesList(moduleNames: string[]): DocSection {
  return {
    id: 'dependencies',
    title: 'Dependencies',
    format: SectionFormat.LIST,
    content: { items: moduleNames },
  };
}

function eventsTable(events: Array<{ name: string; fqn: string }>): DocSection {
  const content: DocTableContent = {
    columns: ['Event', 'FQN'],
    rows: events.map((event) => ({ Event: event.name, FQN: event.fqn })),
  };
  return { id: 'events', title: 'Events', format: SectionFormat.TABLE, content };
}

/**
 * Module-docs content generator (built-in module-docs v1 template; template
 * R2/R4). public-api / dependencies / domain-model / events come from the
 * graph; module-purpose and db-tables are ai.enrich placeholders. The
 * `dependencies` and `events` sections are conditional (template R4).
 */
export function generateModuleDocsDocument(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  _version: number,
  ctx: DocContext,
): GeneratedDocument {
  const entities = extractEntities(nodes);
  const relationships = extractRelationships(edges, nodes);
  const exported = extractExports(nodes, edges);

  const sections: DocSection[] = [
    aiPlaceholder('module-purpose', 'Module Purpose'),
    publicApiTable(exported),
  ];

  if (hasDependencies(edges)) {
    const moduleNames = [...new Set(exported.map((row) => row.module))].sort();
    sections.push(dependenciesList(moduleNames));
  }

  sections.push({
    id: 'domain-model',
    title: 'Domain Model',
    format: SectionFormat.MERMAID_CLASS_DIAGRAM,
    content: { entities, relationships },
  });

  if (hasEvents(nodes)) {
    sections.push(eventsTable(extractEvents(nodes)));
  }

  sections.push(aiPlaceholder('db-tables', 'Database Tables'));

  return buildGeneratedDocument(DocType.MODULE_DOCS, ctx, sections);
}

export class ModuleDocsContentGenerator implements IDocContentGenerator {
  readonly docType = DocType.MODULE_DOCS;

  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument {
    return generateModuleDocsDocument(nodes, edges, version, ctx);
  }
}
