import { createHash } from 'crypto';
import { GraphNode } from '../domain/graph-node.vo';
import { GraphEdge } from '../domain/graph-edge.vo';
import { SemanticModel, SemanticNode, SemanticEdge } from '../domain/semantic-model';

export interface GraphBuildResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
}

export class GraphBuilder {
  build(model: SemanticModel, repoId: string, version: number): GraphBuildResult {
    const warnings: string[] = [];
    const nodesByFqn = new Map<string, GraphNode>();
    const nodes: GraphNode[] = [];
    const seenFqns = new Set<string>();

    for (const semanticNode of model.nodes) {
      if (seenFqns.has(semanticNode.fqn)) {
        warnings.push(`Duplicate node "${semanticNode.fqn}" dropped`);
        continue;
      }

      seenFqns.add(semanticNode.fqn);
      const node = this.buildNode(semanticNode, repoId, version);
      nodes.push(node);
      nodesByFqn.set(node.fqn, node);
    }

    const edges: GraphEdge[] = [];
    const seenEdges = new Set<string>();

    for (const semanticEdge of model.edges) {
      const edgeKey = `${semanticEdge.type}|${semanticEdge.sourceFqn}|${semanticEdge.targetFqn}|${JSON.stringify(
        semanticEdge.properties ?? {},
      )}`;

      if (seenEdges.has(edgeKey)) {
        continue;
      }

      seenEdges.add(edgeKey);

      const sourceNode = nodesByFqn.get(semanticEdge.sourceFqn);
      const targetNode = nodesByFqn.get(semanticEdge.targetFqn);

      if (sourceNode === undefined || targetNode === undefined) {
        warnings.push(
          `Dangling edge ${semanticEdge.type} ${semanticEdge.sourceFqn} -> ${semanticEdge.targetFqn} dropped`,
        );
        continue;
      }

      if (sourceNode.id === targetNode.id) {
        warnings.push(`Self edge ${semanticEdge.type} ${semanticEdge.sourceFqn} dropped`);
        continue;
      }

      edges.push(
        GraphEdge.reconstitute(
          edgeId(semanticEdge, version),
          semanticEdge.type,
          sourceNode.id,
          targetNode.id,
          semanticEdge.properties,
          version,
        ),
      );
    }

    return { nodes, edges, warnings };
  }

  buildDeprecatedNode(previousNode: GraphNode, repoId: string, version: number): GraphNode {
    return GraphNode.reconstitute(
      nodeId(previousNode.fqn, repoId, version),
      previousNode.type,
      previousNode.label,
      previousNode.fqn,
      { ...previousNode.properties },
      repoId,
      version,
      new Date(),
      previousNode.sourceFile,
    );
  }

  private buildNode(semanticNode: SemanticNode, repoId: string, version: number): GraphNode {
    const properties: Record<string, unknown> = { ...semanticNode.properties };

    if (semanticNode.sourceFile !== '') {
      properties.filePath = semanticNode.sourceFile;
    }

    return GraphNode.reconstitute(
      nodeId(semanticNode.fqn, repoId, version),
      semanticNode.type,
      semanticNode.label,
      semanticNode.fqn,
      properties,
      repoId,
      version,
      null,
      semanticNode.sourceFile === '' ? null : semanticNode.sourceFile,
    );
  }
}

function nodeId(fqn: string, repoId: string, version: number): string {
  return deterministicUuid(`${repoId}:${version}:${fqn}`);
}

function edgeId(edge: SemanticEdge, version: number): string {
  return deterministicUuid(`${version}:${edge.type}:${edge.sourceFqn}:${edge.targetFqn}`);
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha1').update(seed).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
