import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { Language } from '@/modules/analysis/domain/language.vo';
import { SemanticModelBuilder } from '@/modules/knowledge-graph/application/semantic-model.builder';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import { IrEnrichment } from '@/modules/ai/domain/ai-enrichment.entity';

const LANGUAGE = Language.create('typescript', '.ts');

function buildIr(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: LANGUAGE,
    packages: [
      {
        name: 'core',
        modules: [
          {
            name: 'src/users',
            path: '/repo/src/users/users.controller.ts',
            classes: [
              { name: 'UsersController' },
              { name: 'UsersService' },
              { name: 'CreateUserDto' },
            ],
          },
        ],
      },
    ],
  });
}

function buildEnrichment(overrides: Partial<Parameters<typeof IrEnrichment.create>[0]> = {}) {
  return IrEnrichment.create({
    analysisId: 'analysis-1',
    repositoryId: 'repo-1',
    manifestSha256: 'abc123',
    framework: 'nestjs',
    architecture: 'mvc',
    confidence: 0.9,
    classes: [
      {
        fqn: 'acme:core:src/users#UsersService',
        role: 'service',
        lifecycle: [],
        dtoFields: [],
        confidence: 0.92,
        sourceFile: 'src/users/users.controller.ts',
      },
      {
        fqn: 'acme:core:src/users#CreateUserDto',
        role: 'dto',
        lifecycle: [],
        dtoFields: [
          { name: 'email', type: 'string', optional: false },
          { name: 'nickname', type: 'string', optional: true },
        ],
        confidence: 0.88,
        sourceFile: 'src/users/users.controller.ts',
      },
      {
        fqn: 'acme:core:src/users#UsersController',
        role: 'controller',
        lifecycle: ['guard:JwtGuard', 'pipe:ValidationPipe', 'interceptor:Logging', 'handler'],
        dtoFields: [],
        confidence: 0.95,
        sourceFile: 'src/users/users.controller.ts',
      },
    ],
    ...overrides,
  });
}

/**
 * Task 5.5 (REQ-EP-007): when IrEnrichment is present, the AI role overrides
 * the deterministic heuristic in resolveClassType, lifecycle entries become
 * GUARD/PIPE/INTERCEPTOR/MIDDLEWARE nodes with PROTECTS/TRANSFORMS edges, and
 * DTO field metadata is attached to DTO nodes.
 */
describe('SemanticModelBuilder with AI enrichment (REQ-EP-007)', () => {
  const builder = new SemanticModelBuilder();

  it('should use the AI role instead of the name-based heuristic', () => {
    // UsersService has no `role` in IR and a heuristic would guess by suffix —
    // the AI enrichment classifies it as `service`.
    const model = builder.build(buildIr(), buildEnrichment());

    const serviceNode = model.nodes.find((node) => node.fqn === 'acme:core:src/users#UsersService');
    expect(serviceNode?.type).toBe(NodeType.SERVICE);
  });

  it('should map AI role dto to a DTO node with field metadata', () => {
    const model = builder.build(buildIr(), buildEnrichment());

    const dtoNode = model.nodes.find((node) => node.fqn === 'acme:core:src/users#CreateUserDto');
    expect(dtoNode?.type).toBe(NodeType.DTO);
    expect(dtoNode?.properties.dtoFields).toEqual([
      { name: 'email', type: 'string', optional: false },
      { name: 'nickname', type: 'string', optional: true },
    ]);
  });

  it('should create GUARD nodes with PROTECTS edges from lifecycle entries', () => {
    const model = builder.build(buildIr(), buildEnrichment());

    const guardNode = model.nodes.find((node) => node.type === NodeType.GUARD);
    expect(guardNode?.label).toBe('JwtGuard');

    const protects = model.edges.find(
      (edge) =>
        edge.type === EdgeType.PROTECTS &&
        edge.sourceFqn === guardNode?.fqn &&
        edge.targetFqn === 'acme:core:src/users#UsersController',
    );
    expect(protects).toBeDefined();
  });

  it('should create PIPE and INTERCEPTOR nodes with TRANSFORMS edges', () => {
    const model = builder.build(buildIr(), buildEnrichment());

    const pipeNode = model.nodes.find((node) => node.type === NodeType.PIPE);
    expect(pipeNode?.label).toBe('ValidationPipe');
    const interceptorNode = model.nodes.find((node) => node.type === NodeType.INTERCEPTOR);
    expect(interceptorNode?.label).toBe('Logging');

    const transforms = model.edges.filter((edge) => edge.type === EdgeType.TRANSFORMS);
    expect(transforms).toHaveLength(2);
  });

  it('should stamp framework and architecture onto the project node', () => {
    const model = builder.build(buildIr(), buildEnrichment());

    const projectNode = model.nodes.find((node) => node.type === NodeType.PROJECT);
    expect(projectNode?.properties).toMatchObject({
      framework: 'nestjs',
      architecture: 'mvc',
    });
  });

  it('should not create lifecycle nodes or edges without enrichment', () => {
    const model = builder.build(buildIr());

    expect(model.nodes.some((node) => node.type === NodeType.GUARD)).toBe(false);
    expect(model.edges.some((edge) => edge.type === EdgeType.PROTECTS)).toBe(false);
  });
});
