import { NodeType } from './node-type.enum';
import { EdgeType } from './edge-type.enum';

export interface SemanticNode {
  type: NodeType;
  label: string;
  fqn: string;
  properties: Record<string, unknown>;
  sourceFile: string;
}

export interface SemanticEdge {
  type: EdgeType;
  sourceFqn: string;
  targetFqn: string;
  /** Optional metadata carried onto the persisted GraphEdge properties (e.g. INVOKES.approximate). */
  properties?: Record<string, unknown>;
}

export interface SemanticModel {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
}
