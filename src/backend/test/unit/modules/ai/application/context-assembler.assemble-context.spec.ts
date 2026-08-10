import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { ContextAssembler } from '@/modules/ai/application/context-assembler.service';
import {
  truncateContextSections,
  ContextSection,
  AssembledContextEnvelope,
} from '@/modules/ai/application/context-assembler.service';
import {
  ContextCacheService,
  contextCacheKey,
} from '@/modules/ai/infrastructure/cache/context-cache.service';
import { AICapability, createCapability } from '@/modules/ai/domain/ai-capability';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';
import { createPromptTemplate } from '@/modules/ai/domain/prompt-template';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';
import { ContextBudgetExceededError } from '@/modules/ai/domain/ai-errors';

/**
 * Task 3.3 (PR9) — assembleContext per the ai-context-assembly spec R1-R5:
 * KG retrieval (R1), truncation with marker (R2), Redis cache (R3), token
 * budget with ContextBudgetExceededError (R4), source file allow/deny-list (R5).
 */
describe('ContextAssembler.assembleContext (ai-context-assembly R1-R5)', () => {
  const REPO = 'repo-1';

  function makeCapability(
    overrides: Partial<Parameters<typeof createContextStrategy>[0]> = {},
  ): AICapability {
    return createCapability({
      id: 'explain-module',
      name: 'Explain Module',
      description: 'Explain a module from KG context',
      version: 1,
      enabled: true,
      contextStrategy: createContextStrategy({
        targetNodeType: NodeType.MODULE,
        relationshipDepth: 1,
        includeDependents: true,
        includeDependencies: true,
        includeApiSurface: true,
        includeEventSurface: false,
        includeDomainContext: false,
        ...overrides,
      }),
      promptTemplate: createPromptTemplate({
        systemInstruction: 'You are a DevLens architect.',
        contextPlaceholder: '{{context}}',
        userQueryWrapper: 'Question: {query}',
        capabilityInstructions: 'Explain the module.',
      }),
      outputFormat: createOutputFormat({ type: 'markdown' }),
      validationRules: [],
    });
  }

  function makeNode(
    id: string,
    type: NodeType,
    fqn: string,
    sourceFile: string | null = null,
    properties: Record<string, unknown> = {},
  ): GraphNode {
    return GraphNode.reconstitute(
      id,
      type,
      fqn.split('#').pop() ?? fqn,
      fqn,
      properties,
      REPO,
      1,
      null,
      sourceFile,
    );
  }

  function makeEdge(id: string, type: EdgeType, source: string, target: string): GraphEdge {
    return GraphEdge.reconstitute(id, type, source, target, {}, 1);
  }

  /** Module target with a dependent controller, a dependency repository, an exposed endpoint, and a depth-2 entity. */
  function buildFixture() {
    const module = makeNode(
      'n0',
      NodeType.MODULE,
      'src/orders/OrderService.ts',
      'src/orders/OrderService.ts',
    );
    const controller = makeNode(
      'n1',
      NodeType.CONTROLLER,
      'src/orders/orders.controller.ts',
      'src/orders/orders.controller.ts',
    );
    const repository = makeNode(
      'n2',
      NodeType.REPOSITORY,
      'src/orders/order.repository.ts',
      'src/orders/order.repository.ts',
    );
    const endpoint = makeNode(
      'n3',
      NodeType.ENDPOINT,
      'src/orders/orders.controller.ts#GET /orders',
      'src/orders/orders.controller.ts',
      {
        httpMethod: 'GET',
        path: '/orders',
      },
    );
    const entity = makeNode(
      'n4',
      NodeType.ENTITY,
      'src/orders/order.entity.ts',
      'src/orders/order.entity.ts',
    );

    const nodes = [module, controller, repository, endpoint, entity];
    const edges = [
      makeEdge('e0', EdgeType.IMPORTS, controller.id, module.id),
      makeEdge('e1', EdgeType.DEPENDS_ON, module.id, repository.id),
      makeEdge('e2', EdgeType.EXPOSES, controller.id, endpoint.id),
      makeEdge('e3', EdgeType.DEPENDS_ON, repository.id, entity.id),
    ];

    return { module, controller, repository, endpoint, entity, nodes, edges };
  }

  function setup(options: {
    graph?: { nodes: GraphNode[]; edges: GraphEdge[]; version: number } | null;
    cache?: ContextCacheService;
    cacheValue?: string | null;
    withCache?: boolean;
  }) {
    const graphQueryService = {
      findAllNodesAndEdges: jest.fn().mockResolvedValue(options.graph ?? null),
    } as unknown as GraphQueryService;

    const cache: ContextCacheService | undefined =
      options.cache ??
      ({
        get: jest.fn().mockResolvedValue(options.cacheValue ?? null),
        set: jest.fn().mockResolvedValue(undefined),
        invalidate: jest.fn().mockResolvedValue(undefined),
      } as unknown as ContextCacheService);

    const assembler = new ContextAssembler(
      {} as never,
      graphQueryService,
      {} as never,
      {
        classify: (path: string) => ({ include: /\.(ts|tsx|js|jsx|py|java|go)$/.test(path) }),
      } as never,
      {} as never,
      options.withCache === false ? undefined : cache,
    );

    return { assembler, graphQueryService, cache };
  }

  describe('R1 — KG retrieval with depth', () => {
    it('should include target, direct dependents, direct dependencies and API surface at depth 1', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(result.target?.fqn).toBe('src/orders/OrderService.ts');
      expect(result.dependents.map((n) => n.fqn)).toContain('src/orders/orders.controller.ts');
      expect(result.dependencies.map((n) => n.fqn)).toContain('src/orders/order.repository.ts');
      expect(result.apiSurface.map((n) => n.fqn)).toContain(
        'src/orders/orders.controller.ts#GET /orders',
      );
    });

    it('should exclude transitive relationships at depth 2+ when relationshipDepth is 1', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      const content = result.content;
      expect(content).not.toContain('order.entity.ts');
    });

    it('should include transitive relationships when relationshipDepth is 2', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability({ relationshipDepth: 2 }),
      );

      expect(result.content).toContain('order.entity.ts');
    });

    it('should exclude dependents when includeDependents is false', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability({ includeDependents: false }),
      );

      expect(result.dependents).toEqual([]);
      expect(result.content).not.toContain('orders.controller.ts');
    });

    it('should return an empty envelope when the target node is not in the graph', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/missing/Missing.ts',
        makeCapability(),
      );

      expect(result.target).toBeNull();
      expect(result.content).toBe('');
      expect(result.cacheHit).toBe(false);
    });

    it('should return an empty envelope when the graph is null', async () => {
      const { assembler } = setup({ graph: null });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(result.target).toBeNull();
      expect(result.content).toBe('');
    });
  });

  describe('R4 — token budget and ContextBudgetExceededError', () => {
    it('should not truncate when content fits within maxContextTokens', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(result.truncated).toBe(false);
      expect(result.truncationMarker).toBeNull();
      expect(result.tokenEstimate).toBeLessThanOrEqual(4000);
    });

    it('should truncate and mark the truncation point when the budget is exceeded', async () => {
      const { module, edges } = buildFixture();
      const dependents = Array.from({ length: 60 }, (_, index) =>
        makeNode(
          `dep-${index}`,
          NodeType.SERVICE,
          `src/modules/m${index}/s${index}.service.ts`,
          `src/modules/m${index}/s${index}.service.ts`,
        ),
      );
      const nodes = [module, ...dependents];
      const allEdges = [
        ...edges.filter((edge) => edge.sourceNodeId === module.id),
        ...dependents.map((dep, index) =>
          makeEdge(`d-${index}`, EdgeType.IMPORTS, dep.id, module.id),
        ),
      ];

      const { assembler } = setup({ graph: { nodes, edges: allEdges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability({ maxContextTokens: 1000 }),
      );

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('[TRUNCATED:');
      expect(result.tokenEstimate).toBeLessThanOrEqual(1000);
    });

    it('should throw ContextBudgetExceededError when a single node cannot fit the budget', async () => {
      const huge = makeNode(
        'n0',
        NodeType.MODULE,
        'src/orders/OrderService.ts',
        'src/orders/OrderService.ts',
        {
          giantProperty: 'x'.repeat(20_000),
        },
      );
      const { assembler } = setup({ graph: { nodes: [huge], edges: [], version: 1 } });

      await expect(
        assembler.assembleContext(REPO, 'src/orders/OrderService.ts', makeCapability()),
      ).rejects.toThrow(ContextBudgetExceededError);
    });
  });

  describe('R3 — Redis context cache', () => {
    it('should serve a cached envelope without querying the graph and set cacheHit', async () => {
      const { module, nodes, edges } = buildFixture();
      const cachedEnvelope: AssembledContextEnvelope = {
        capability: 'explain-module',
        nodeId: 'src/orders/OrderService.ts',
        depth: 1,
        target: {
          fqn: module.fqn,
          label: module.label,
          type: module.type,
          sourceFile: module.sourceFile,
          properties: {},
        },
        dependents: [],
        dependencies: [],
        apiSurface: [],
        eventSurface: [],
        domainContext: [],
        sourceFiles: ['src/orders/OrderService.ts'],
        content: '# Target: src/orders/OrderService.ts',
        tokenEstimate: 4,
        truncated: false,
        truncationMarker: null,
        cacheHit: false,
      };
      const { assembler, graphQueryService } = setup({
        graph: { nodes, edges, version: 1 },
        cacheValue: JSON.stringify(cachedEnvelope),
      });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(graphQueryService.findAllNodesAndEdges).not.toHaveBeenCalled();
      expect(result.cacheHit).toBe(true);
      expect(result.content).toBe('# Target: src/orders/OrderService.ts');
    });

    it('should use the context:{capability}:{nodeId}:{depth} key when storing a miss', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler, cache } = setup({ graph: { nodes, edges, version: 1 } });

      await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability({ relationshipDepth: 2 }),
      );

      expect(cache.get).toHaveBeenCalledWith('context:explain-module:src/orders/OrderService.ts:2');
      expect(cache.set).toHaveBeenCalledWith(
        'context:explain-module:src/orders/OrderService.ts:2',
        expect.stringContaining('explain-module'),
        expect.anything(),
      );
    });

    it('should work without a cache (graceful degradation)', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler, cache } = setup({ graph: { nodes, edges, version: 1 }, withCache: false });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(result.cacheHit).toBe(false);
      expect(cache.get).not.toHaveBeenCalled();
      expect(result.content).toContain('OrderService');
    });
  });

  describe('R5 — source file allow/deny-list', () => {
    it('should exclude a node whose sourceFile is an .env file from the assembled context', async () => {
      const module = makeNode(
        'n0',
        NodeType.MODULE,
        'src/orders/OrderService.ts',
        'src/orders/OrderService.ts',
      );
      const envNode = makeNode('n1', NodeType.UNKNOWN, '.env.local', '.env.local');
      const nodes = [module, envNode];
      const edges = [makeEdge('e0', EdgeType.IMPORTS, envNode.id, module.id)];

      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(result.dependents.map((n) => n.fqn)).not.toContain('.env.local');
      expect(result.content).not.toContain('.env.local');
    });

    it('should include source files that pass the allow-list', async () => {
      const { nodes, edges } = buildFixture();
      const { assembler } = setup({ graph: { nodes, edges, version: 1 } });

      const result = await assembler.assembleContext(
        REPO,
        'src/orders/OrderService.ts',
        makeCapability(),
      );

      expect(result.sourceFiles).toContain('src/orders/OrderService.ts');
      expect(result.sourceFiles).toContain('src/orders/orders.controller.ts');
      expect(result.sourceFiles).toContain('src/orders/order.repository.ts');
    });
  });
});

describe('truncateContextSections (R2/R4 pure logic)', () => {
  function sections(overrides: Partial<Record<string, string[]>> = {}): ContextSection[] {
    return [
      { header: '# Target', lines: ['src/orders/OrderService.ts (Module)'] },
      {
        header: '## Dependents',
        lines: overrides.dependents ?? ['a.controller.ts', 'b.controller.ts'],
      },
      { header: '## Dependencies', lines: overrides.dependencies ?? ['repo.ts'] },
    ];
  }

  it('should keep content untouched within budget', () => {
    const result = truncateContextSections(sections(), 100, 'explain-module');

    expect(result.truncated).toBe(false);
    expect(result.content).toContain('## Dependents');
    expect(result.truncationMarker).toBeNull();
  });

  it('should drop lowest-priority lines and mark the truncation point when over budget', () => {
    const manyDependents = Array.from({ length: 30 }, (_, index) => `m${index}/x.controller.ts`);
    const result = truncateContextSections(
      sections({ dependents: manyDependents }),
      20,
      'explain-module',
    );

    expect(result.truncated).toBe(true);
    expect(result.content).toContain('[TRUNCATED:');
    expect(result.tokenEstimate).toBeLessThanOrEqual(20);
    expect(result.content).toMatch(/\[TRUNCATED: \d+ items omitted\]/);
  });

  it('should keep the target section and drop the tail when only the tail overflows', () => {
    const result = truncateContextSections(
      sections({ dependencies: ['x.ts', 'y.ts', 'z.ts'] }),
      15,
      'explain-module',
    );

    expect(result.truncated).toBe(true);
    expect(result.content).toContain('OrderService');
    expect(result.content).not.toContain('z.ts');
  });

  it('should throw ContextBudgetExceededError when the target section alone exceeds the budget', () => {
    const oversized: ContextSection[] = [{ header: '# Target', lines: ['y'.repeat(2000)] }];

    expect(() => truncateContextSections(oversized, 50, 'explain-module')).toThrow(
      ContextBudgetExceededError,
    );
  });
});

describe('contextCacheKey integration (R3)', () => {
  it('should build the key consumed by assembleContext from capability, nodeId and depth', () => {
    expect(contextCacheKey('explain-module', 'src/orders/OrderService.ts', 1)).toBe(
      'context:explain-module:src/orders/OrderService.ts:1',
    );
  });
});
