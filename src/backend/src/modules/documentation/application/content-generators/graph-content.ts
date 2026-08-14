import { GraphNode } from '../../../knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '../../../knowledge-graph/domain/graph-edge.vo';
import { NodeType } from '../../../knowledge-graph/domain/node-type.enum';
import { EdgeType } from '../../../knowledge-graph/domain/edge-type.enum';
import { DiagramEntity, DiagramRelationship, FlowNode, FlowEdge } from '../../domain/doc-document';

/**
 * Pure extraction helpers over Knowledge Graph output (template R2/R4 sources:
 * `graph.exports`, `graph.entities`, `graph.dependencies`, `graph.endpoints`,
 * `graph.events`). Content generators consume these; every function is a pure
 * function over (nodes, edges) so generators stay deterministic.
 */

export interface ExportRow {
  module: string;
  name: string;
  type: NodeType;
  fqn: string;
}

export interface EndpointRow {
  method: string;
  path: string;
  controller: string;
}

export interface EventRow {
  name: string;
  fqn: string;
}

export interface FlowchartData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Class-level node types considered part of a module's public surface. */
const EXPORTED_TYPES = new Set<NodeType>([
  NodeType.CONTROLLER,
  NodeType.SERVICE,
  NodeType.REPOSITORY,
  NodeType.ENTITY,
  NodeType.DTO,
  NodeType.INTERFACE,
]);

/** Entity nodes → DiagramEntity (attributes from dtoFields when present). */
export function extractEntities(nodes: readonly GraphNode[]): DiagramEntity[] {
  return nodes
    .filter((node) => node.type === NodeType.ENTITY)
    .map((node) => ({
      name: node.label,
      attributes: Array.isArray(node.properties.dtoFields)
        ? (node.properties.dtoFields as string[])
        : [],
      methods: [],
    }));
}

/** Relationships: EXTENDS → inheritance, IMPLEMENTS → aggregation. */
export function extractRelationships(
  edges: readonly GraphEdge[],
  nodes: readonly GraphNode[],
): DiagramRelationship[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const relationships: DiagramRelationship[] = [];

  for (const edge of edges) {
    if (edge.type !== EdgeType.EXTENDS && edge.type !== EdgeType.IMPLEMENTS) {
      continue;
    }
    const source = byId.get(edge.sourceNodeId);
    const target = byId.get(edge.targetNodeId);
    if (source === undefined || target === undefined) {
      continue;
    }
    relationships.push({
      from: source.label,
      to: target.label,
      kind: edge.type === EdgeType.EXTENDS ? 'inheritance' : 'aggregation',
    });
  }

  return relationships;
}

/** Module nodes (graph.exports scope / bounded-context map). */
export function extractModules(nodes: readonly GraphNode[]): GraphNode[] {
  return nodes.filter((node) => node.type === NodeType.MODULE);
}

/**
 * Public API surface per module: class-level nodes whose `isExported`
 * property is not false, grouped by their BELONGS_TO module.
 */
export function extractExports(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): ExportRow[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const moduleByClass = new Map<string, string>();

  for (const edge of edges) {
    if (edge.type !== EdgeType.BELONGS_TO) {
      continue;
    }
    const module = byId.get(edge.targetNodeId);
    if (module?.type === NodeType.MODULE) {
      moduleByClass.set(edge.sourceNodeId, module.label);
    }
  }

  const rows: ExportRow[] = [];
  for (const node of nodes) {
    if (!EXPORTED_TYPES.has(node.type)) {
      continue;
    }
    if (node.properties.isExported === false) {
      continue;
    }
    rows.push({
      module: moduleByClass.get(node.id) ?? 'unknown',
      name: node.label,
      type: node.type,
      fqn: node.fqn,
    });
  }

  return rows.sort((a, b) => (a.fqn < b.fqn ? -1 : a.fqn > b.fqn ? 1 : 0));
}

/** Endpoint nodes → { method, path, controller } using EXPOSES edges. */
export function extractEndpoints(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): EndpointRow[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const controllerByEndpoint = new Map<string, string>();

  for (const edge of edges) {
    if (edge.type !== EdgeType.EXPOSES) {
      continue;
    }
    const controller = byId.get(edge.sourceNodeId);
    if (controller !== undefined) {
      controllerByEndpoint.set(edge.targetNodeId, controller.label);
    }
  }

  const rows: EndpointRow[] = [];
  for (const node of nodes) {
    if (node.type !== NodeType.ENDPOINT) {
      continue;
    }
    rows.push({
      method: String(node.properties.httpMethod ?? 'GET'),
      path: String(node.properties.path ?? '/'),
      controller: controllerByEndpoint.get(node.id) ?? '',
    });
  }

  return rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Domain events: nodes whose label ends in "Event" (deterministic heuristic). */
export function extractEvents(nodes: readonly GraphNode[]): EventRow[] {
  return nodes
    .filter((node) => /Event$/.test(node.label))
    .map((node) => ({ name: node.label, fqn: node.fqn }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** External dependency labels (tech-stack list). */
export function extractExternalDeps(nodes: readonly GraphNode[]): string[] {
  return nodes
    .filter((node) => node.type === NodeType.EXTERNAL_DEPENDENCY)
    .map((node) => node.label)
    .sort();
}

/** Modules + DEPENDS_ON edges → flowchart nodes/edges (dependency map). */
export function extractDependencyGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): FlowchartData {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const moduleByFqn = new Map<string, string>();

  for (const node of nodes) {
    if (node.type === NodeType.MODULE) {
      moduleByFqn.set(node.fqn, node.label);
    }
  }

  const flowNodes: FlowNode[] = extractModules(nodes).map((module) => ({
    id: module.label,
    label: module.label,
  }));

  const flowEdges: FlowEdge[] = [];
  for (const edge of edges) {
    if (edge.type !== EdgeType.DEPENDS_ON) {
      continue;
    }
    const source = byId.get(edge.sourceNodeId);
    const target = byId.get(edge.targetNodeId);
    if (source?.type !== NodeType.MODULE || target?.type !== NodeType.MODULE) {
      continue;
    }
    flowEdges.push({ from: source.label, to: target.label });
  }

  return { nodes: flowNodes, edges: flowEdges };
}

/** Condition helpers (template R4). */
export function hasEvents(nodes: readonly GraphNode[]): boolean {
  return extractEvents(nodes).length > 0;
}

export function hasDependencies(edges: readonly GraphEdge[]): boolean {
  return edges.some((edge) => edge.type === EdgeType.DEPENDS_ON);
}

export function hasEndpoints(nodes: readonly GraphNode[]): boolean {
  return nodes.some((node) => node.type === NodeType.ENDPOINT);
}

/**
 * Builds the GeneratedDocument envelope shared by every content generator
 * (documentation-generation R3). The generator supplies the structured
 * sections; the envelope carries the domain metadata from DocContext.
 */
export function buildGeneratedDocument(
  docType: import('../../domain/doc-type.enum').DocType,
  ctx: { repositoryId: string; commitSha: string; templateVersion: string; title: string },
  sections: import('../../domain/doc-document').DocSection[],
): import('../../domain/doc-document').GeneratedDocument {
  return {
    docType,
    templateVersion: ctx.templateVersion,
    title: ctx.title,
    repositoryId: ctx.repositoryId,
    commitSha: ctx.commitSha,
    generatedAt: new Date().toISOString(),
    sections,
  };
}
