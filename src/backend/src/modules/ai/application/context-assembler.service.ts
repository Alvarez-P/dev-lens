import { Injectable, Logger, Optional } from '@nestjs/common';
import { AnalysisId } from '../../analysis/domain';
import { AnalysisRepository } from '../../analysis/infrastructure/persistence/repositories/analysis.repository';
import { GraphQueryService } from '../../knowledge-graph/application/graph-query.service';
import { GraphNode } from '../../knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '../../knowledge-graph/domain/graph-edge.vo';
import { NodeType } from '../../knowledge-graph/domain/node-type.enum';
import { EdgeType } from '../../knowledge-graph/domain/edge-type.enum';
import { CodeSketch } from '../domain/code-sketch.vo';
import { CodeSketchBuilder, serializeSketch } from './code-sketch.builder';
import { SourceFileFilter } from './source-file-filter';
import { SketchCache, sketchCacheKey } from './sketch-cache';
import { ContextStrategy } from '../domain/context-strategy';
import { AICapability } from '../domain/ai-capability';
import { ContextBudgetExceededError } from '../domain/ai-errors';
import {
  ContextCacheService,
  contextCacheKey,
  CONTEXT_CACHE_TTL_MS,
} from '../infrastructure/cache/context-cache.service';

/** Total assembly budget: ≤5000 tokens, leaving 1000 for prompt framing (REQ-CA-001). */
export const ASSEMBLY_BUDGET_TOKENS = 5000;

/** Priority classification used for budget truncation (REQ-CA-005). */
export type SketchPriority = 'controller' | 'service' | 'dto' | 'other';

export interface KgContext {
  projectName: string;
  language: string;
  moduleCount: number;
  fileCount: number;
  nodeFqns: string[];
  relationshipSummary: string;
  /** Detected architecture (layered/modular/hexagonal), 'unknown' when undetected. */
  architecture?: string;
}

export interface AssembledContext {
  sketches: CodeSketch[];
  kgContext: KgContext;
}

/** A KG node rendered into the LLM context envelope (ai-context-assembly R1). */
export interface ContextNodeRef {
  fqn: string;
  label: string;
  type: NodeType;
  sourceFile: string | null;
  properties: Readonly<Record<string, unknown>>;
}

/** Result of a neighborhood traversal around the target node (R1). */
export interface ContextNeighborhood {
  target: GraphNode | null;
  /** Nodes that depend on the target (incoming edges at depth 1). */
  dependents: GraphNode[];
  /** Nodes the target depends on (outgoing edges at depth 1). */
  dependencies: GraphNode[];
  /** Endpoints exposed by the target or its direct neighbors. */
  apiSurface: GraphNode[];
  /** Bounded-context ancestors (Package/Project via BELONGS_TO). */
  domainContext: GraphNode[];
  /** Nodes reached at depth >= 2 (transitive, truncated first). */
  transitive: GraphNode[];
}

/** One serialized section of the context content (R2 truncation unit). */
export interface ContextSection {
  header: string;
  lines: string[];
}

/** Outcome of budget-aware content assembly (R2/R4). */
export interface TruncationResult {
  content: string;
  /** Token estimate of the kept context (excludes the truncation marker). */
  tokenEstimate: number;
  truncated: boolean;
  truncationMarker: string | null;
}

/**
 * LLM context envelope produced by assembleContext (ai-context-assembly R1-R5).
 * `truncated` and `cacheHit` feed downstream observability (R2/R3).
 */
export interface AssembledContextEnvelope {
  capability: string;
  nodeId: string;
  depth: number;
  target: ContextNodeRef | null;
  dependents: ContextNodeRef[];
  dependencies: ContextNodeRef[];
  apiSurface: ContextNodeRef[];
  eventSurface: ContextNodeRef[];
  domainContext: ContextNodeRef[];
  /** Source files that passed the allow/deny-list, in context order. */
  sourceFiles: string[];
  content: string;
  tokenEstimate: number;
  truncated: boolean;
  truncationMarker: string | null;
  cacheHit: boolean;
}

/** Marker appended at the truncation point (R2). */
export const TRUNCATION_MARKER = (omitted: number): string =>
  `[TRUNCATED: ${omitted} items omitted]`;

/** ~4 chars per token heuristic shared with estimateSketchTokens (design decision). */
export function estimateContextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const EMPTY_KG_CONTEXT: KgContext = {
  projectName: '',
  language: '',
  moduleCount: 0,
  fileCount: 0,
  nodeFqns: [],
  relationshipSummary: '',
};

/**
 * Assembles signature-level context for LLM enrichment (REQ-CA-001) and
 * capability-scoped Knowledge Graph context for the AI orchestration pipeline
 * (ai-context-assembly R1-R5).
 *
 * The enrichment path reads exclusively from GraphQueryService (service-level
 * DI) and AnalysisRepository (IR) — never the filesystem. Produces one
 * CodeSketch per source file, enforces the allow/deny-list, keeps the total
 * ≤5000 tokens via priority truncation, and caches sketches content-addressed
 * by file sha256 (REQ-CA-005/006).
 *
 * The orchestration path (`assembleContext`) queries the KG neighborhood
 * around a target node up to the capability's relationshipDepth, applies the
 * source-file allow/deny-list, truncates to `maxContextTokens` with an
 * explicit marker, and caches the envelope in Redis
 * (`context:{capability}:{nodeId}:{depth}`, TTL 5m). The cache is optional —
 * module wiring is deferred to PR14; without it the assembler degrades to a
 * cache miss with no write (mirroring ContextCacheService's graceful
 * degradation).
 */
@Injectable()
export class ContextAssembler {
  private readonly logger = new Logger(ContextAssembler.name);

  constructor(
    private readonly analysisRepository: AnalysisRepository,
    private readonly graphQueryService: GraphQueryService,
    private readonly sketchBuilder: CodeSketchBuilder,
    private readonly fileFilter: SourceFileFilter,
    private readonly sketchCache: SketchCache,
    @Optional() private readonly contextCache?: ContextCacheService,
  ) {}

  async assemble(analysisId: string): Promise<AssembledContext> {
    const analysis = await this.analysisRepository.findById(AnalysisId.from(analysisId));

    if (analysis === null || analysis.ir === null) {
      return { sketches: [], kgContext: EMPTY_KG_CONTEXT };
    }

    const ir = analysis.ir;
    const manifest = analysis.fileManifest ?? {};
    const modules = ir.packages.flatMap((pkg) => pkg.modules);

    // Apply the allow/deny-list once — non-source files are silently skipped,
    // deny-list matches are warn-logged (REQ-CA-004).
    const relativePaths = modules.map((module) => this.toRepoRelative(module.path, ir.rootPath));
    const includedPaths = new Set(this.fileFilter.filter(relativePaths));

    const sketches: CodeSketch[] = [];

    for (const module of modules) {
      const relativePath = this.toRepoRelative(module.path, ir.rootPath);

      if (!includedPaths.has(relativePath)) {
        continue;
      }

      const sha256 = manifest[relativePath];
      const cacheKey = sha256 !== undefined ? sketchCacheKey(sha256) : null;

      if (cacheKey !== null) {
        const cached = this.sketchCache.get(cacheKey);

        if (cached !== undefined) {
          sketches.push(cached);
          continue;
        }
      }

      const sketch = this.sketchBuilder.build(module, ir.rootPath);

      if (sketch === null) {
        continue;
      }

      if (cacheKey !== null) {
        this.sketchCache.set(cacheKey, sketch);
      }

      sketches.push(sketch);
    }

    const withinBudget = this.enforceTotalBudget(sketches);
    const kgContext = await this.buildKgContext(analysis.repositoryId.toString(), ir.name);

    return { sketches: withinBudget, kgContext };
  }

  /**
   * Assembles Knowledge Graph context for one AI capability invocation
   * (ai-context-assembly R1-R5).
   *
   * `nodeId` is the target node's FQN — it doubles as the cache-key nodeId
   * component (`context:{capability}:{nodeId}:{depth}`, PR7 contract) and the
   * graph lookup key. Flow: cache hit → serve; miss → query the KG
   * neighborhood up to `relationshipDepth`, apply the source-file
   * allow/deny-list, truncate to `maxContextTokens` with an explicit marker,
   * cache, return.
   */
  async assembleContext(
    repoId: string,
    nodeId: string,
    capability: AICapability,
  ): Promise<AssembledContextEnvelope> {
    const strategy = capability.contextStrategy;
    const depth = strategy.relationshipDepth;
    const cacheKey = contextCacheKey(capability.id, nodeId, depth);

    // R3: cache hit short-circuits the KG query entirely.
    if (this.contextCache !== undefined) {
      const cached = await this.contextCache.get(cacheKey);

      if (cached !== null) {
        const envelope = JSON.parse(cached) as AssembledContextEnvelope;
        return { ...envelope, cacheHit: true };
      }
    }

    const graph = await this.graphQueryService.findAllNodesAndEdges(repoId);

    if (graph === null) {
      return this.emptyEnvelope(capability, nodeId, depth);
    }

    const neighborhood = collectNeighborhood(graph.nodes, graph.edges, nodeId, strategy);

    if (neighborhood.target === null) {
      return this.emptyEnvelope(capability, nodeId, depth);
    }

    // R5: drop nodes whose sourceFile fails the allow/deny-list, silently.
    const keepNode = (node: GraphNode): boolean =>
      node.sourceFile === null || this.fileFilter.classify(node.sourceFile).include;

    const dependents = neighborhood.dependents.filter(keepNode);
    const dependencies = neighborhood.dependencies.filter(keepNode);
    const apiSurface = neighborhood.apiSurface.filter(keepNode);
    const domainContext = neighborhood.domainContext.filter(keepNode);
    const transitive = neighborhood.transitive.filter(keepNode);

    const sections: ContextSection[] = [
      { header: '# Target', lines: [serializeTargetNode(neighborhood.target)] },
      { header: '## Dependents', lines: dependents.map(serializeContextNode) },
      { header: '## Dependencies', lines: dependencies.map(serializeContextNode) },
      { header: '## API Surface', lines: apiSurface.map(serializeContextNode) },
      { header: '## Domain Context', lines: domainContext.map(serializeContextNode) },
      { header: '## Transitive Relationships', lines: transitive.map(serializeContextNode) },
    ];

    const { content, tokenEstimate, truncated, truncationMarker } = truncateContextSections(
      sections,
      strategy.maxContextTokens,
      capability.id,
    );

    const sourceFiles = this.collectSourceFiles([
      neighborhood.target,
      ...dependents,
      ...dependencies,
      ...apiSurface,
      ...domainContext,
      ...transitive,
    ]);

    const envelope: AssembledContextEnvelope = {
      capability: capability.id,
      nodeId,
      depth,
      target: toContextNodeRef(neighborhood.target),
      dependents: dependents.map(toContextNodeRef),
      dependencies: dependencies.map(toContextNodeRef),
      apiSurface: apiSurface.map(toContextNodeRef),
      eventSurface: [],
      domainContext: domainContext.map(toContextNodeRef),
      sourceFiles,
      content,
      tokenEstimate,
      truncated,
      truncationMarker,
      cacheHit: false,
    };

    if (this.contextCache !== undefined) {
      await this.contextCache.set(cacheKey, JSON.stringify(envelope), CONTEXT_CACHE_TTL_MS);
    }

    return envelope;
  }

  private collectSourceFiles(nodes: readonly GraphNode[]): string[] {
    const seen = new Set<string>();
    const files: string[] = [];

    for (const node of nodes) {
      if (node.sourceFile === null || seen.has(node.sourceFile)) {
        continue;
      }

      seen.add(node.sourceFile);
      files.push(node.sourceFile);
    }

    return files;
  }

  private emptyEnvelope(
    capability: AICapability,
    nodeId: string,
    depth: number,
  ): AssembledContextEnvelope {
    return {
      capability: capability.id,
      nodeId,
      depth,
      target: null,
      dependents: [],
      dependencies: [],
      apiSurface: [],
      eventSurface: [],
      domainContext: [],
      sourceFiles: [],
      content: '',
      tokenEstimate: 0,
      truncated: false,
      truncationMarker: null,
      cacheHit: false,
    };
  }

  /**
   * REQ-CA-005: verify total token estimate ≤5000. Drop lowest-priority files
   * first (controllers > services > DTOs > others) until the budget fits.
   */
  private enforceTotalBudget(sketches: CodeSketch[]): CodeSketch[] {
    const total = sketches.reduce((sum, sketch) => sum + estimateSketchTokens(sketch), 0);

    if (total <= ASSEMBLY_BUDGET_TOKENS) {
      return sketches;
    }

    const sorted = [...sketches].sort((a, b) => priorityRank(a) - priorityRank(b));
    let kept = [...sorted];

    while (
      kept.length > 1 &&
      kept.reduce((sum, sketch) => sum + estimateSketchTokens(sketch), 0) > ASSEMBLY_BUDGET_TOKENS
    ) {
      kept = kept.slice(0, -1);
    }

    const dropped = sketches.length - kept.length;

    if (dropped > 0) {
      this.logger.warn(
        `AI context: dropped ${dropped} file(s) to fit ${ASSEMBLY_BUDGET_TOKENS}-token budget`,
      );
    }

    return kept;
  }

  private async buildKgContext(repoId: string, fallbackProjectName: string): Promise<KgContext> {
    const graph = await this.graphQueryService.findAllNodesAndEdges(repoId);

    if (graph === null) {
      return { ...EMPTY_KG_CONTEXT, projectName: fallbackProjectName };
    }

    const projectNode = graph.nodes.find((node) => node.type === 'Project');

    const edgeSummary = new Map<string, number>();

    for (const edge of graph.edges) {
      edgeSummary.set(edge.type, (edgeSummary.get(edge.type) ?? 0) + 1);
    }

    const relationshipSummary =
      [...edgeSummary.entries()].map(([type, count]) => `${count} ${type}`).join(', ') || 'none';

    return {
      projectName: projectNode?.label ?? fallbackProjectName,
      language: (projectNode?.properties?.language as string | undefined) ?? '',
      moduleCount: graph.nodes.filter((node) => node.type === 'Module').length,
      fileCount: new Set(graph.nodes.map((node) => node.sourceFile).filter(Boolean)).size,
      nodeFqns: graph.nodes.map((node) => node.fqn),
      relationshipSummary,
    };
  }

  private toRepoRelative(filePath: string, rootPath: string): string {
    const normalizedRoot = rootPath.replace(/\/+$/, '');

    if (filePath.startsWith(normalizedRoot)) {
      return filePath.slice(normalizedRoot.length).replace(/^\/+/, '');
    }

    return filePath;
  }
}

export function estimateSketchTokens(sketch: CodeSketch): number {
  return Math.ceil(serializeSketch(sketch).length / 4);
}

/** Priority for budget truncation: 0 = controller (keep first), 3 = other. */
export function priorityRank(sketch: CodeSketch): number {
  return priorityOrder(priorityOf(sketch));
}

export function priorityOf(sketch: CodeSketch): SketchPriority {
  const isController =
    sketch.decorators.some((decorator) => decorator.startsWith('@Controller')) ||
    sketch.className.endsWith('Controller');
  const isService =
    sketch.decorators.some((decorator) => decorator.startsWith('@Injectable')) ||
    sketch.className.endsWith('Service');
  const isDto = /(Dto|DTO|dto)$/.test(sketch.className);

  if (isController) {
    return 'controller';
  }

  if (isService) {
    return 'service';
  }

  if (isDto) {
    return 'dto';
  }

  return 'other';
}

function priorityOrder(priority: SketchPriority): number {
  switch (priority) {
    case 'controller':
      return 0;
    case 'service':
      return 1;
    case 'dto':
      return 2;
    case 'other':
      return 3;
  }
}

/**
 * Collects the KG neighborhood around a target node up to `relationshipDepth`
 * (ai-context-assembly R1). Direct (hop 1) nodes split into dependents
 * (incoming edges) and dependencies (outgoing edges); hop >= 2 nodes land in
 * `transitive` so truncation can drop them first (R2). API surface collects
 * ENDPOINT nodes exposed by the target or its direct neighbors; domain context
 * walks the BELONGS_TO ancestry (bounded context). Pure — no I/O.
 */
export function collectNeighborhood(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  targetFqn: string,
  strategy: ContextStrategy,
): ContextNeighborhood {
  const target = GraphQueryService.getNodeByFqn(nodes, targetFqn);

  if (target === null) {
    return {
      target: null,
      dependents: [],
      dependencies: [],
      apiSurface: [],
      domainContext: [],
      transitive: [],
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const depth = strategy.relationshipDepth;
  const dependents: GraphNode[] = [];
  const dependencies: GraphNode[] = [];
  const transitive: GraphNode[] = [];
  const visited = new Set<string>([target.id]);
  const queue: Array<{ nodeId: string; hop: number }> = [{ nodeId: target.id, hop: 0 }];

  while (queue.length > 0) {
    const { nodeId, hop } = queue.shift()!;

    if (hop >= depth) {
      continue;
    }

    for (const edge of edges) {
      // Incoming edge: the source depends on nodeId.
      if (strategy.includeDependents && edge.targetNodeId === nodeId) {
        const neighbor = nodeById.get(edge.sourceNodeId);

        if (
          neighbor !== undefined &&
          !visited.has(neighbor.id) &&
          neighbor.type !== NodeType.ENDPOINT
        ) {
          visited.add(neighbor.id);
          (hop === 0 ? dependents : transitive).push(neighbor);
          queue.push({ nodeId: neighbor.id, hop: hop + 1 });
        }
      }

      // Outgoing edge: nodeId depends on the target.
      if (strategy.includeDependencies && edge.sourceNodeId === nodeId) {
        const neighbor = nodeById.get(edge.targetNodeId);

        if (
          neighbor !== undefined &&
          !visited.has(neighbor.id) &&
          neighbor.type !== NodeType.ENDPOINT
        ) {
          visited.add(neighbor.id);
          (hop === 0 ? dependencies : transitive).push(neighbor);
          queue.push({ nodeId: neighbor.id, hop: hop + 1 });
        }
      }
    }
  }

  const apiSurface: GraphNode[] = [];

  if (strategy.includeApiSurface) {
    const sources = new Set([target, ...dependents, ...dependencies].map((node) => node.id));
    const endpointIds = new Set<string>();

    for (const edge of edges) {
      if (edge.type !== EdgeType.EXPOSES || !sources.has(edge.sourceNodeId)) {
        continue;
      }

      const endpoint = nodeById.get(edge.targetNodeId);

      if (
        endpoint !== undefined &&
        endpoint.type === NodeType.ENDPOINT &&
        !endpointIds.has(endpoint.id)
      ) {
        endpointIds.add(endpoint.id);
        apiSurface.push(endpoint);
      }
    }
  }

  const domainContext: GraphNode[] = [];

  if (strategy.includeDomainContext) {
    let current = target;
    const seen = new Set<string>([current.id]);

    for (;;) {
      const belongsTo = edges.find(
        (edge) => edge.type === EdgeType.BELONGS_TO && edge.sourceNodeId === current.id,
      );

      if (belongsTo === undefined) {
        break;
      }

      const parent = nodeById.get(belongsTo.targetNodeId);

      if (parent === undefined || seen.has(parent.id)) {
        break;
      }

      seen.add(parent.id);
      domainContext.push(parent);
      current = parent;
    }
  }

  return { target, dependents, dependencies, apiSurface, domainContext, transitive };
}

/**
 * Assembles section content within `maxTokens`, truncating lowest-priority
 * (last) sections first (ai-context-assembly R2). The target section is never
 * truncated — if it alone exceeds the budget, a ContextBudgetExceededError is
 * raised with the actual token count (R4). Pure — no I/O.
 */
export function truncateContextSections(
  sections: readonly ContextSection[],
  maxTokens: number,
  contextLabel: string,
): TruncationResult {
  let content = '';
  let truncated = false;

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const header = `${section.header}\n`;
    let sectionStarted = false;

    for (let lineIndex = 0; lineIndex < section.lines.length; lineIndex++) {
      const line = section.lines[lineIndex];
      const candidate = sectionStarted ? `${line}\n` : `${header}${line}\n`;
      const candidateTokens = estimateContextTokens(content + candidate);

      if (sectionIndex === 0 && candidateTokens > maxTokens) {
        throw new ContextBudgetExceededError(
          'unknown',
          contextLabel,
          `Context budget exceeded: currentTokens=${candidateTokens}, budget=${maxTokens}`,
        );
      }

      if (candidateTokens > maxTokens) {
        truncated = true;
        let omitted = 0;

        for (let s = sectionIndex; s < sections.length; s++) {
          const lines = sections[s].lines;
          omitted += s === sectionIndex ? lines.length - lineIndex : lines.length;
        }

        const marker = TRUNCATION_MARKER(omitted);

        return {
          content: `${content}${marker}\n`,
          tokenEstimate: estimateContextTokens(content),
          truncated,
          truncationMarker: marker,
        };
      }

      content += candidate;
      sectionStarted = true;
    }
  }

  return {
    content,
    tokenEstimate: estimateContextTokens(content),
    truncated: false,
    truncationMarker: null,
  };
}

/** Renders the target node with its properties (R1: "target node properties"). */
function serializeTargetNode(node: GraphNode): string {
  const file = node.sourceFile !== null ? ` [${node.sourceFile}]` : '';
  const props =
    Object.keys(node.properties).length > 0 ? ` ${JSON.stringify(node.properties)}` : '';

  return `${node.label} (${node.fqn}${file})${props}`;
}

/** Renders one neighborhood node as a bullet line. */
function serializeContextNode(node: GraphNode): string {
  const file = node.sourceFile !== null ? ` [${node.sourceFile}]` : '';

  return `- ${node.label} (${node.fqn}${file})`;
}

function toContextNodeRef(node: GraphNode): ContextNodeRef {
  return {
    fqn: node.fqn,
    label: node.label,
    type: node.type,
    sourceFile: node.sourceFile,
    properties: node.properties,
  };
}
