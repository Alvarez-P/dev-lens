import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ExportResponseDto,
  GraphExportQueryDto,
  GraphNodesQueryDto,
  GraphQueryNodeDetailDto,
} from '@/modules/knowledge-graph/infrastructure/controllers/graph-query.dto';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';

function errorsOf<T extends object>(dtoClass: new () => T, value: Record<string, unknown>) {
  const instance = plainToInstance(dtoClass, value);
  return { instance, errors: validateSync(instance) };
}

describe('Graph query DTOs', () => {
  describe('GraphNodesQueryDto.type', () => {
    it('accepts a single type for backward compatibility', () => {
      const { errors } = errorsOf(GraphNodesQueryDto, { type: NodeType.CONTROLLER });

      expect(errors).toHaveLength(0);
    });

    it('accepts multiple types via an array', () => {
      const { errors } = errorsOf(GraphNodesQueryDto, {
        type: [NodeType.CONTROLLER, NodeType.SERVICE],
      });

      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid single type', () => {
      const { errors } = errorsOf(GraphNodesQueryDto, { type: 'NonExistentType' });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('type');
    });

    it('rejects an array containing an invalid type', () => {
      const { errors } = errorsOf(GraphNodesQueryDto, {
        type: [NodeType.CONTROLLER, 'BogusType'],
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('type');
    });

    it('treats the type as optional', () => {
      const { errors } = errorsOf(GraphNodesQueryDto, {});

      expect(errors).toHaveLength(0);
    });
  });

  describe('GraphExportQueryDto', () => {
    it('accepts an explicit version', () => {
      const { errors } = errorsOf(GraphExportQueryDto, { version: 3 });

      expect(errors).toHaveLength(0);
    });

    it('treats the version as optional', () => {
      const { errors } = errorsOf(GraphExportQueryDto, {});

      expect(errors).toHaveLength(0);
    });

    it.each([0, -1, 1.5, 'abc'])('rejects an invalid version %p', (version) => {
      const { errors } = errorsOf(GraphExportQueryDto, { version });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('version');
    });
  });

  describe('GraphQueryNodeDetailDto.direction', () => {
    it.each(['in', 'out', 'both'] as const)('accepts direction=%s', (direction) => {
      const { errors } = errorsOf(GraphQueryNodeDetailDto, { direction });

      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid direction', () => {
      const { errors } = errorsOf(GraphQueryNodeDetailDto, { direction: 'sideways' });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('direction');
    });

    it('defaults to "both" when omitted', () => {
      const { instance } = errorsOf(GraphQueryNodeDetailDto, {});

      expect(instance.direction).toBe('both');
    });
  });

  describe('ExportResponseDto', () => {
    it('carries nodes, edges, and meta with counts and version', () => {
      const instance = plainToInstance(ExportResponseDto, {
        nodes: [
          {
            id: 'node-1',
            type: NodeType.CONTROLLER,
            label: 'UsersController',
            fqn: 'acme:users#UsersController',
            properties: {},
            repoId: 'repo-1',
            version: 3,
            deprecatedAt: null,
          },
        ],
        edges: [
          {
            id: 'edge-1',
            type: 'EXPOSES',
            sourceNodeId: 'node-1',
            targetNodeId: 'node-2',
            properties: {},
            version: 3,
          },
        ],
        meta: { nodeCount: 1, edgeCount: 1, version: 3 },
      });

      expect(instance.nodes).toHaveLength(1);
      expect(instance.nodes[0].fqn).toBe('acme:users#UsersController');
      expect(instance.edges).toHaveLength(1);
      expect(instance.meta).toEqual({ nodeCount: 1, edgeCount: 1, version: 3 });
    });
  });
});
