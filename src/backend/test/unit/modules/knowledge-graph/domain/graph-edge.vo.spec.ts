import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

describe('GraphEdge value object', () => {
  describe('create', () => {
    it('should create an edge with a generated UUID and provided fields', () => {
      const edge = GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', 'node-b', { kind: 'import' }, 1);

      expect(edge.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(edge.type).toBe(EdgeType.DEPENDS_ON);
      expect(edge.sourceNodeId).toBe('node-a');
      expect(edge.targetNodeId).toBe('node-b');
      expect(edge.properties).toEqual({ kind: 'import' });
      expect(edge.version).toBe(1);
    });

    it('should default properties to an empty object when omitted', () => {
      const edge = GraphEdge.create(EdgeType.EXTENDS, 'node-a', 'node-b', undefined, 1);

      expect(edge.properties).toEqual({});
    });

    it('should reject an unknown edge type', () => {
      expect(() => GraphEdge.create('CALLS' as EdgeType, 'node-a', 'node-b', undefined, 1)).toThrow(
        'Unknown edge type',
      );
    });

    it('should reject an empty sourceNodeId', () => {
      expect(() => GraphEdge.create(EdgeType.DEPENDS_ON, ' ', 'node-b', undefined, 1)).toThrow(
        'Edge sourceNodeId must not be empty',
      );
    });

    it('should reject an empty targetNodeId', () => {
      expect(() => GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', '', undefined, 1)).toThrow(
        'Edge targetNodeId must not be empty',
      );
    });

    it('should reject a self-referencing edge', () => {
      expect(() => GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', 'node-a', undefined, 1)).toThrow(
        'Edge sourceNodeId and targetNodeId must differ',
      );
    });

    it('should reject a version below one', () => {
      expect(() => GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', 'node-b', undefined, 0)).toThrow(
        'Edge version must be a positive integer',
      );
    });
  });

  describe('equality', () => {
    it('should equal itself', () => {
      const edge = GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', 'node-b', undefined, 1);

      expect(edge.equals(edge)).toBe(true);
    });

    it('should not equal an edge with a different target', () => {
      const edgeA = GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', 'node-b', undefined, 1);
      const edgeB = GraphEdge.create(EdgeType.DEPENDS_ON, 'node-a', 'node-c', undefined, 1);

      expect(edgeA.equals(edgeB)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize to a plain object', () => {
      const edge = GraphEdge.reconstitute(
        'edge-1',
        EdgeType.EXPOSES,
        'node-controller',
        'node-endpoint',
        { httpMethod: 'GET', path: '/users' },
        2,
      );

      expect(edge.toJSON()).toEqual({
        id: 'edge-1',
        type: 'EXPOSES',
        sourceNodeId: 'node-controller',
        targetNodeId: 'node-endpoint',
        properties: { httpMethod: 'GET', path: '/users' },
        version: 2,
      });
    });
  });

  describe('reconstitute', () => {
    it('should restore a persisted edge with an explicit id', () => {
      const edge = GraphEdge.reconstitute(
        'edge-1',
        EdgeType.IMPLEMENTS,
        'node-class',
        'node-interface',
        undefined,
        1,
      );

      expect(edge.id).toBe('edge-1');
      expect(edge.type).toBe(EdgeType.IMPLEMENTS);
    });
  });
});
