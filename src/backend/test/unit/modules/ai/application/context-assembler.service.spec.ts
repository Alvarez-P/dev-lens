import { Logger } from '@nestjs/common';
import { Language } from '@/modules/analysis/domain/language.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { Analysis, AnalysisId, AnalysisStatus } from '@/modules/analysis/domain';
import { SnapshotId, RepositoryId } from '@/modules/repositories/domain';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { CodeSketchBuilder, serializeSketch } from '@/modules/ai/application/code-sketch.builder';
import { SourceFileFilter } from '@/modules/ai/application/source-file-filter';
import { SketchCache } from '@/modules/ai/application/sketch-cache';
import {
  ContextAssembler,
  AssembledContext,
} from '@/modules/ai/application/context-assembler.service';
import { CodeSketch } from '@/modules/ai/domain/code-sketch.vo';

const typescript = Language.create('typescript', '.ts');

/**
 * Task 4.4 (REQ-CA-001/005/006): ContextAssembler reads KG + IR via services
 * (never filesystem), produces one CodeSketch per file, enforces the
 * allow/deny-list, keeps the total ≤5000 tokens with priority truncation, and
 * caches sketches content-addressed by `ai:sketch:{sha256}`.
 */
describe('ContextAssembler (REQ-CA-001/005/006)', () => {
  function makeAnalysis(options: {
    fileManifest?: Record<string, string>;
    modules?: {
      path: string;
      classes: { name: string; decorators?: string[]; methods?: unknown[] }[];
    }[];
    imports?: string[];
  }): Analysis {
    const ir = IrProject.create({
      name: 'acme',
      rootPath: '/repo',
      language: typescript,
      packages: [
        {
          name: 'core',
          modules: (options.modules ?? []).map((mod) => ({
            name: mod.path.replace('/repo/', '').replace(/\.ts$/, ''),
            path: mod.path,
            imports: options.imports ?? [],
            classes: mod.classes.map((cls) => ({
              name: cls.name,
              decorators: cls.decorators,
              methods: (cls.methods ?? []) as never[],
            })),
          })),
        },
      ],
    });

    return Analysis.reconstitute(
      AnalysisId.from('analysis-X'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      ir,
      options.fileManifest ?? {},
      null,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
    );
  }

  function setup(options: {
    analysis: Analysis;
    graphResult?: { nodes: unknown[]; edges: unknown[]; version: number } | null;
  }) {
    const analysisRepository = {
      findById: jest.fn().mockResolvedValue(options.analysis),
    } as unknown as AnalysisRepository;

    const graphQueryService = {
      findAllNodesAndEdges: jest.fn().mockResolvedValue(options.graphResult ?? null),
    } as unknown as GraphQueryService;

    const sketchCache = new SketchCache();

    const assembler = new ContextAssembler(
      analysisRepository,
      graphQueryService,
      new CodeSketchBuilder(),
      new SourceFileFilter(),
      sketchCache,
    );

    return { assembler, analysisRepository, graphQueryService, sketchCache };
  }

  describe('context assembled from IR (REQ-CA-001)', () => {
    it('should produce one CodeSketch per source file', async () => {
      const analysis = makeAnalysis({
        modules: [
          {
            path: '/repo/src/users/users.controller.ts',
            classes: [{ name: 'UsersController', decorators: ["@Controller('users')"] }],
          },
          {
            path: '/repo/src/users/users.service.ts',
            classes: [{ name: 'UsersService', decorators: ['@Injectable()'] }],
          },
        ],
      });
      const { assembler, analysisRepository } = setup({ analysis });

      const result = await assembler.assemble('analysis-X');

      expect(analysisRepository.findById).toHaveBeenCalledWith(expect.any(AnalysisId));
      expect(result.sketches).toHaveLength(2);
      expect(result.sketches.map((sketch) => sketch.className)).toEqual([
        'UsersController',
        'UsersService',
      ]);
      expect(result.sketches[0].sourceFile).toBe('src/users/users.controller.ts');
      expect(result.kgContext).toBeDefined();
    });

    it('should return empty sketches when the module list is empty', async () => {
      const analysis = makeAnalysis({ modules: [] });
      const { assembler } = setup({ analysis });

      const result = await assembler.assemble('analysis-X');

      expect(result.sketches).toEqual([]);
    });
  });

  describe('allow/deny-list enforcement (REQ-CA-004)', () => {
    it('should exclude .env files with a warning', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        const analysis = makeAnalysis({
          modules: [
            {
              path: '/repo/.env.local',
              classes: [{ name: 'EnvConfig' }],
            },
            {
              path: '/repo/src/app.controller.ts',
              classes: [{ name: 'AppController', decorators: ["@Controller('')"] }],
            },
          ],
        });
        const { assembler } = setup({ analysis });

        const result = await assembler.assemble('analysis-X');

        expect(result.sketches.map((sketch) => sketch.sourceFile)).toEqual([
          'src/app.controller.ts',
        ]);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('excluded .env.local'));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should silently skip non-source files', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        const analysis = makeAnalysis({
          modules: [
            { path: '/repo/package.json', classes: [{ name: 'Pkg' }] },
            { path: '/repo/src/main.ts', classes: [{ name: 'Main' }] },
          ],
        });
        const { assembler } = setup({ analysis });

        const result = await assembler.assemble('analysis-X');

        expect(result.sketches.map((sketch) => sketch.sourceFile)).toEqual(['src/main.ts']);
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('token budget guard (REQ-CA-005)', () => {
    function sketchCosts(context: AssembledContext): number {
      return context.sketches.reduce(
        (total, sketch) => total + Math.ceil(serializeSketch(sketch).length / 4),
        0,
      );
    }

    it('should drop lowest-priority files when total exceeds 5000 tokens', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        // 60 service/DTO files with long signatures — far beyond 5000 tokens
        const modules = Array.from({ length: 60 }, (_, index) => ({
          path: `/repo/src/modules/m${index}/x.service.ts`,
          classes: [
            {
              name: `Service${index}`,
              decorators: ['@Injectable()'],
              methods: Array.from({ length: 12 }, (_, methodIndex) => ({
                name: `doSomething${methodIndex}`,
                visibility: 'public',
                decorators: [`@EventHandler('some.event.${methodIndex}')`],
                params: [
                  {
                    name: `input${methodIndex}`,
                    type: 'VeryLongDtoTypeNameThatInflatesTokens',
                    decorators: ['@Inject(SomeVeryLongTokenName)'],
                  },
                  {
                    name: `context${methodIndex}`,
                    type: 'AnotherLongExecutionContextTypeName',
                    decorators: [],
                  },
                ],
                returnType: 'Promise<VeryLongResultTypeName>',
              })),
            },
          ],
        }));

        const analysis = makeAnalysis({ modules });
        const { assembler } = setup({ analysis });

        const result = await assembler.assemble('analysis-X');

        expect(result.sketches.length).toBeGreaterThan(0);
        expect(result.sketches.length).toBeLessThan(60);
        expect(sketchCosts(result)).toBeLessThanOrEqual(5000);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dropped'));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should keep controllers and drop non-controller files first', async () => {
      const modules = [
        {
          path: '/repo/src/users/users.controller.ts',
          classes: [{ name: 'UsersController', decorators: ["@Controller('users')"] }],
        },
        ...Array.from({ length: 40 }, (_, index) => ({
          path: `/repo/src/dto/dto${index}.dto.ts`,
          classes: [
            {
              name: `Dto${index}`,
              methods: [
                {
                  name: 'field',
                  visibility: 'public',
                  decorators: [],
                  params: [{ name: 'v', type: 'SomeVeryLongDtoFieldTypeName', decorators: [] }],
                  returnType: 'string',
                },
              ],
            },
          ],
        })),
      ];
      const analysis = makeAnalysis({ modules });
      const { assembler } = setup({ analysis });

      const result = await assembler.assemble('analysis-X');

      expect(result.sketches.some((sketch) => sketch.className === 'UsersController')).toBe(true);
    });

    it('should return all sketches when within budget', async () => {
      const analysis = makeAnalysis({
        modules: [
          { path: '/repo/src/a.controller.ts', classes: [{ name: 'AController' }] },
          { path: '/repo/src/b.service.ts', classes: [{ name: 'BService' }] },
        ],
      });
      const { assembler } = setup({ analysis });

      const result = await assembler.assemble('analysis-X');

      expect(result.sketches).toHaveLength(2);
    });
  });

  describe('content-addressed caching (REQ-CA-006)', () => {
    it('should return a cached sketch on cache hit without rebuilding', async () => {
      const manifest = { 'src/users/users.controller.ts': 'abc123' };
      const analysis = makeAnalysis({
        fileManifest: manifest,
        modules: [
          { path: '/repo/src/users/users.controller.ts', classes: [{ name: 'UsersController' }] },
        ],
      });

      const sketchCache = new SketchCache();
      const cached: CodeSketch = {
        sourceFile: 'src/users/users.controller.ts',
        className: 'UsersController',
        decorators: [],
        implements: [],
        constructorParams: [],
        methods: [],
        imports: [],
        truncated: false,
      };
      sketchCache.set('ai:sketch:abc123', cached);

      const builder = { build: jest.fn() } as unknown as CodeSketchBuilder;
      const assembler = new ContextAssembler(
        { findById: jest.fn().mockResolvedValue(analysis) } as unknown as AnalysisRepository,
        {
          findAllNodesAndEdges: jest.fn().mockResolvedValue(null),
        } as unknown as GraphQueryService,
        builder,
        new SourceFileFilter(),
        sketchCache,
      );

      const result = await assembler.assemble('analysis-X');

      expect(builder.build).not.toHaveBeenCalled();
      expect(result.sketches).toEqual([cached]);
    });

    it('should build and store a sketch on cache miss', async () => {
      const manifest = { 'src/users/users.controller.ts': 'abc123' };
      const analysis = makeAnalysis({
        fileManifest: manifest,
        modules: [
          { path: '/repo/src/users/users.controller.ts', classes: [{ name: 'UsersController' }] },
        ],
      });

      const sketchCache = new SketchCache();
      const assembler = new ContextAssembler(
        { findById: jest.fn().mockResolvedValue(analysis) } as unknown as AnalysisRepository,
        {
          findAllNodesAndEdges: jest.fn().mockResolvedValue(null),
        } as unknown as GraphQueryService,
        new CodeSketchBuilder(),
        new SourceFileFilter(),
        sketchCache,
      );

      const result = await assembler.assemble('analysis-X');

      expect(sketchCache.get('ai:sketch:abc123')).toEqual(result.sketches[0]);
      expect(result.sketches[0].className).toBe('UsersController');
    });
  });
});
