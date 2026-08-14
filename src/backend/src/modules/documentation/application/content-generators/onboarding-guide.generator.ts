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

function repoStructureList(moduleLabels: string[]): DocSection {
  const content: DocListContent = { items: moduleLabels };
  return {
    id: 'repo-structure',
    title: 'Repository Structure',
    format: SectionFormat.LIST,
    content,
  };
}

function keyModulesTable(modules: Array<{ label: string; fqn: string }>): DocSection {
  const content: DocTableContent = {
    columns: ['Module', 'FQN'],
    rows: modules.map((module) => ({ Module: module.label, FQN: module.fqn })),
  };
  return { id: 'key-modules', title: 'Key Modules', format: SectionFormat.TABLE, content };
}

/**
 * Onboarding-guide content generator (built-in onboarding-guide v1 template;
 * template R2/R4). repo-structure / key-modules / architecture-overview come
 * from the graph; dev-setup / common-workflows / glossary are ai.enrich
 * placeholders.
 */
export function generateOnboardingGuideDocument(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  _version: number,
  ctx: DocContext,
): GeneratedDocument {
  const entities = extractEntities(nodes);
  const relationships = extractRelationships(edges, nodes);
  const modules = extractModules(nodes);
  const moduleLabels = modules.map((module) => module.label).sort();

  const sections: DocSection[] = [
    repoStructureList(moduleLabels),
    keyModulesTable(modules),
    {
      id: 'architecture-overview',
      title: 'Architecture Overview',
      format: SectionFormat.MERMAID_CLASS_DIAGRAM,
      content: { entities, relationships },
    },
    aiPlaceholder('dev-setup', 'Development Setup'),
    aiPlaceholder('common-workflows', 'Common Workflows'),
    aiPlaceholder('glossary', 'Glossary'),
  ];

  return buildGeneratedDocument(DocType.ONBOARDING_GUIDE, ctx, sections);
}

export class OnboardingGuideContentGenerator implements IDocContentGenerator {
  readonly docType = DocType.ONBOARDING_GUIDE;

  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument {
    return generateOnboardingGuideDocument(nodes, edges, version, ctx);
  }
}
