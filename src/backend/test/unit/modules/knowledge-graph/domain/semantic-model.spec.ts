import { SemanticNode, SemanticEdge } from '@/modules/knowledge-graph/domain/semantic-model';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

describe('Semantic model', () => {
  it('should describe a transient SemanticNode as a plain object', () => {
    const node: SemanticNode = {
      type: NodeType.SERVICE,
      label: 'AuthService',
      fqn: 'acme:core:src/auth#AuthService',
      properties: { exported: true },
      sourceFile: '/repo/src/auth/auth.service.ts',
    };

    expect(node.type).toBe(NodeType.SERVICE);
    expect(node.label).toBe('AuthService');
    expect(node.fqn).toBe('acme:core:src/auth#AuthService');
    expect(node.properties).toEqual({ exported: true });
    expect(node.sourceFile).toBe('/repo/src/auth/auth.service.ts');
  });

  it('should describe a transient SemanticEdge as a plain object', () => {
    const edge: SemanticEdge = {
      type: EdgeType.DEPENDS_ON,
      sourceFqn: 'acme:core:src/auth#AuthService',
      targetFqn: 'acme:core:src/users#UserRepository',
    };

    expect(edge.type).toBe(EdgeType.DEPENDS_ON);
    expect(edge.sourceFqn).toBe('acme:core:src/auth#AuthService');
    expect(edge.targetFqn).toBe('acme:core:src/users#UserRepository');
  });

  it('should be serializable with JSON.stringify without custom logic', () => {
    const node: SemanticNode = {
      type: NodeType.UNKNOWN,
      label: 'Helper',
      fqn: 'acme:core:src/utils#Helper',
      properties: {},
      sourceFile: '/repo/src/utils/helper.ts',
    };
    const edge: SemanticEdge = {
      type: EdgeType.IMPORTS,
      sourceFqn: 'acme:core:src/utils#Helper',
      targetFqn: 'rxjs',
    };

    const payload = JSON.stringify({ node, edge });

    expect(payload).toContain('"type":"Unknown"');
    expect(payload).toContain('"type":"IMPORTS"');
    expect(payload).toContain('"sourceFqn":"acme:core:src/utils#Helper"');
  });
});
