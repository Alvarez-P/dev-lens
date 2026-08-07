import { Injectable, Logger } from '@nestjs/common';
import { AnalysisId } from '../../analysis/domain';
import { AnalysisRepository } from '../../analysis/infrastructure/persistence/repositories/analysis.repository';
import { GraphQueryService } from '../../knowledge-graph/application/graph-query.service';
import { CodeSketch } from '../domain/code-sketch.vo';
import { CodeSketchBuilder, serializeSketch } from './code-sketch.builder';
import { SourceFileFilter } from './source-file-filter';
import { SketchCache, sketchCacheKey } from './sketch-cache';

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

const EMPTY_KG_CONTEXT: KgContext = {
  projectName: '',
  language: '',
  moduleCount: 0,
  fileCount: 0,
  nodeFqns: [],
  relationshipSummary: '',
};

/**
 * Assembles signature-level context for LLM enrichment (REQ-CA-001).
 *
 * Reads exclusively from GraphQueryService (service-level DI) and
 * AnalysisRepository (IR) — never the filesystem. Produces one CodeSketch per
 * source file, enforces the allow/deny-list, keeps the total ≤5000 tokens via
 * priority truncation, and caches sketches content-addressed by file sha256
 * (REQ-CA-005/006).
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
