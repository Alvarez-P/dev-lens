import { IrProject, Language } from '@/modules/analysis/domain';
import { SemanticModelBuilder } from '@/modules/knowledge-graph/application/semantic-model.builder';
import { GraphBuilder } from '@/modules/knowledge-graph/application/graph.builder';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

function buildFixtureIr(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: Language.create('typescript', '.ts'),
    packages: [
      {
        name: 'default',
        modules: [
          {
            name: 'src/users',
            path: '/repo/src/users/users.module.ts',
            classes: [
              {
                name: 'UsersController',
                role: 'controller',
                endpoints: [{ name: 'findAll', httpMethod: 'GET', path: '/users', parameters: [] }],
              },
              { name: 'UsersService', role: 'service' },
            ],
          },
        ],
      },
    ],
  });
}

describe('Graph pipeline round-trip', () => {
  it('should build a typed graph from a fixture IR with no dangling edges', () => {
    const ir = buildFixtureIr();

    const model = new SemanticModelBuilder().build(ir);
    const result = new GraphBuilder().build(model, 'repo-1', 1);

    expect(model.nodes).toHaveLength(6);
    expect(model.edges).toHaveLength(5);

    const nodeTypes = result.nodes.map((node) => node.type).sort();
    expect(nodeTypes).toEqual([
      NodeType.CONTROLLER,
      NodeType.ENDPOINT,
      NodeType.MODULE,
      NodeType.PACKAGE,
      NodeType.PROJECT,
      NodeType.SERVICE,
    ]);

    const edgeTypes = result.edges.map((edge) => edge.type).sort();
    expect(edgeTypes).toEqual([
      EdgeType.BELONGS_TO,
      EdgeType.BELONGS_TO,
      EdgeType.BELONGS_TO,
      EdgeType.BELONGS_TO,
      EdgeType.EXPOSES,
    ]);
  });

  it('should preserve FQNs through both builder stages', () => {
    const ir = buildFixtureIr();

    const model = new SemanticModelBuilder().build(ir);
    const result = new GraphBuilder().build(model, 'repo-1', 1);

    const endpoint = result.nodes.find((node) => node.type === NodeType.ENDPOINT);
    expect(endpoint?.fqn).toBe('acme:default:src/users#UsersController.GET:/users');

    const controller = result.nodes.find((node) => node.type === NodeType.CONTROLLER);
    expect(controller?.fqn).toBe('acme:default:src/users#UsersController');
    expect(controller?.properties.filePath).toBe('src/users/users.module.ts');

    const exposes = result.edges.find((edge) => edge.type === EdgeType.EXPOSES);
    expect(exposes?.sourceNodeId).toBe(controller?.id);
    expect(exposes?.targetNodeId).toBe(endpoint?.id);
  });

  it('should leave no dangling edges for the fixture', () => {
    const ir = buildFixtureIr();

    const model = new SemanticModelBuilder().build(ir);
    const result = new GraphBuilder().build(model, 'repo-1', 1);

    expect(result.warnings).toEqual([]);

    const nodeIds = new Set(result.nodes.map((node) => node.id));
    for (const edge of result.edges) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
    }
  });
});
