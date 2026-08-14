import { DocType } from './doc-type.enum';
import { SectionFormat } from './doc-template';

/**
 * Shared document model consumed by renderers (design: two-layer rendering).
 * Content generators produce a GeneratedDocument; renderers transform its
 * structured sections into output formats.
 */

export interface DocTableContent {
  columns?: string[];
  rows: Array<Record<string, unknown>>;
}

export interface DocListContent {
  items: unknown[];
}

export interface DiagramEntity {
  name: string;
  attributes: string[];
  methods: string[];
}

export interface DiagramRelationship {
  from: string;
  to: string;
  kind: 'inheritance' | 'composition' | 'aggregation' | 'association';
  label?: string;
}

export interface DocClassDiagramContent {
  entities: DiagramEntity[];
  relationships: DiagramRelationship[];
}

export interface FlowNode {
  id: string;
  label?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DocFlowchartContent {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface DocPlantUmlContent {
  entities: DiagramEntity[];
  relationships: DiagramRelationship[];
}

export interface DocMarkdownContent {
  markdown: string;
}

export interface DocJsonContent {
  data: unknown;
}

/** Structured content of a section, discriminated by section.format. */
export type DocSectionContent =
  | DocTableContent
  | DocListContent
  | DocClassDiagramContent
  | DocFlowchartContent
  | DocPlantUmlContent
  | DocMarkdownContent
  | DocJsonContent;

export interface DocSection {
  id: string;
  title: string;
  format: SectionFormat;
  content: DocSectionContent;
  /** True when this section was produced by AI enrichment (generation R6). */
  aiGenerated?: boolean;
}

/** Full structured documentation payload handed to renderers. */
export interface GeneratedDocument {
  docType: DocType;
  templateVersion: string;
  title: string;
  repositoryId: string;
  commitSha: string;
  generatedAt: string;
  sections: DocSection[];
}
