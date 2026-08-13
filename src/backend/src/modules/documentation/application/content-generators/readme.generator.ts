import { DocType } from '../../domain/doc-type.enum';
import { SectionFormat } from '../../domain/doc-template';
import {
  GeneratedDocument,
  DocSection,
  DocTableContent,
  DocListContent,
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
  extractExternalDeps,
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

function moduleIndexTable(modules: Array<{ label: string; fqn: string }>): DocSection {
  const content: DocTableContent = {
    columns: ['Module', 'FQN'],
    rows: modules.map((module) => ({ Module: module.label, FQN: module.fqn })),
  };
  return { id: 'module-index', title: 'Module Index', format: SectionFormat.TABLE, content };
}

function techStackList(items: string[]): DocSection {
  const content: DocListContent = { items };
  return { id: 'tech-stack', title: 'Technology Stack', format: SectionFormat.LIST, content };
}

/**
 * README content generator (built-in readme v1 template; template R2/R4).
 * Pure function over GraphQueryService output: project-overview and
 * getting-started are ai.enrich placeholder sections (the DocEnricherService
 * fills them); architecture-diagram / module-index / tech-stack are extracted
 * deterministically from the graph.
 */
export function generateReadmeDocument(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  _version: number,
  ctx: DocContext,
): GeneratedDocument {
  const entities = extractEntities(nodes);
  const relationships = extractRelationships(edges, nodes);
  const modules = extractModules(nodes);
  const techStack = extractExternalDeps(nodes);

  const sections: DocSection[] = [
    aiPlaceholder('project-overview', 'Project Overview'),
    {
      id: 'architecture-diagram',
      title: 'Architecture Diagram',
      format: SectionFormat.MERMAID_CLASS_DIAGRAM,
      content: { entities, relationships },
    },
    moduleIndexTable(modules),
    techStackList(techStack),
    aiPlaceholder('getting-started', 'Getting Started'),
  ];

  return buildGeneratedDocument(DocType.README, ctx, sections);
}

export class ReadmeContentGenerator implements IDocContentGenerator {
  readonly docType = DocType.README;

  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument {
    return generateReadmeDocument(nodes, edges, version, ctx);
  }
}
