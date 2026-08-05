import { Injectable, Inject, Logger } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, posix } from 'path';
import { randomUUID } from 'crypto';

import { Analysis } from '../domain/analysis.entity';
import { AnalysisStatus, InvalidIrError } from '../domain';
import { IrProject, IrModule, IrDependencyProps, IrRelationshipProps } from '../domain/ir-nodes';
import { Language } from '../domain/language.vo';
import { LanguageDetector } from '../domain/services/language-detector.service';
import { IrValidator } from '../domain/services/ir-validator.service';
import { ParseResult } from '../domain/parse-result.vo';
import { ParsedFile } from '../domain/parsed-file.vo';
import { ParserRegistry } from '../domain/interfaces/parser-registry.interface';
import { TypeScriptIrBuilder } from '../infrastructure/parsers/typescript/typescript-ir-builder';
import { AnalysisRepository } from '../infrastructure/persistence/repositories/analysis.repository';
import { FileManifestService, FileDiff, IGNORED_DIRECTORIES } from './file-manifest.service';
import { SnapshotRepository } from '../../repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '../../repositories/infrastructure/git/git.service';
import { SnapshotId, RepositoryId } from '../../repositories/domain';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';
import { ConfigService } from '../../../config/config.service';
import { PARSER_REGISTRY } from '../analysis.tokens';

export interface AnalysisJobData {
  snapshotId: string;
  repositoryId: string;
}

interface IrBuildOutcome {
  ir: IrProject;
  reuseRatio: number | null;
}

@Injectable()
export class StaticAnalysisService {
  private readonly logger = new Logger(StaticAnalysisService.name);

  constructor(
    private readonly snapshotRepository: SnapshotRepository,
    private readonly gitService: GitService,
    private readonly languageDetector: LanguageDetector,
    @Inject(PARSER_REGISTRY)
    private readonly parserRegistry: ParserRegistry,
    private readonly irBuilder: TypeScriptIrBuilder,
    private readonly irValidator: IrValidator,
    private readonly analysisRepository: AnalysisRepository,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly manifestService: FileManifestService,
    private readonly configService: ConfigService,
  ) {}

  async analyze(input: AnalysisJobData): Promise<void> {
    const { snapshotId, repositoryId } = input;
    const snapshotIdVo = SnapshotId.from(snapshotId);
    const repositoryIdVo = RepositoryId.from(repositoryId);

    const existing = await this.analysisRepository.findBySnapshotId(snapshotIdVo);

    if (existing !== null && existing.status === AnalysisStatus.COMPLETED && existing.ir !== null) {
      this.logger.log(`Analysis already completed for snapshot ${snapshotId}; skipping`);
      return;
    }

    const analysis = Analysis.create(snapshotIdVo, repositoryIdVo);
    const correlationId = randomUUID();

    try {
      analysis.startProcessing(null, correlationId);

      const snapshot = await this.snapshotRepository.findById(repositoryId, snapshotId);

      if (snapshot === null) {
        throw new Error(`Snapshot "${snapshotId}" not found`);
      }

      const repoPath = this.gitService.getRepoPath(repositoryId);
      const previous = await this.analysisRepository.findLatestByRepo(repositoryIdVo);
      const fileManifest = this.manifestService.computeManifest(repoPath);
      const outcome = this.buildIr(repoPath, snapshotId, fileManifest, previous);

      const validation = this.irValidator.validate(outcome.ir);

      if (!validation.isValid) {
        throw new InvalidIrError([...validation.errors]);
      }

      analysis.completeProcessing(
        outcome.ir,
        fileManifest,
        null,
        correlationId,
        outcome.reuseRatio,
      );
      await this.analysisRepository.save(analysis);
      await this.eventDispatcher.dispatchBatch(analysis.domainEvents);

      this.logger.log(`Analysis completed for snapshot ${snapshotId}: ${analysis.id.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown analysis error';
      this.logger.error(`Analysis failed for snapshot ${snapshotId}: ${message}`);

      if (
        analysis.status === AnalysisStatus.PENDING ||
        analysis.status === AnalysisStatus.PROCESSING
      ) {
        analysis.failProcessing(message, null, correlationId);
        await this.analysisRepository.save(analysis);
        await this.eventDispatcher.dispatchBatch(analysis.domainEvents);
      }

      throw error;
    }
  }

  private buildIr(
    repoPath: string,
    snapshotId: string,
    fileManifest: Record<string, string>,
    previous: Analysis | null,
  ): IrBuildOutcome {
    const totalFiles = Object.keys(fileManifest).length;
    const previousIr = previous?.ir ?? null;
    const previousManifest = previous?.fileManifest ?? null;

    if (previousIr === null || previousManifest === null) {
      return { ir: this.runFullAnalysis(repoPath, snapshotId), reuseRatio: null };
    }

    const diff = this.manifestService.diffManifests(fileManifest, previousManifest);

    if (
      this.manifestService.shouldFullReparse(
        diff,
        totalFiles,
        this.configService.analysis.staticAnalysisThreshold,
      )
    ) {
      this.logger.log(
        `Analysis for snapshot ${snapshotId}: ${diff.added.length + diff.modified.length + diff.deleted.length}/${totalFiles} files changed; falling back to full re-parse`,
      );

      return { ir: this.runFullAnalysis(repoPath, snapshotId), reuseRatio: null };
    }

    return this.runIncrementalAnalysis(repoPath, snapshotId, previousIr, diff, totalFiles);
  }

  private runFullAnalysis(repoPath: string, snapshotId: string): IrProject {
    const filePaths = this.walkSourceFiles(repoPath);
    const groups = this.languageDetector.detectMany(filePaths);
    const parseResults = this.parseFileGroups(groups);

    const { ir, diagnostics } = this.irBuilder.build(parseResults, {
      projectName: snapshotId,
      rootPath: repoPath,
    });

    if (diagnostics.length > 0) {
      this.logger.warn(
        `Analysis for snapshot ${snapshotId} produced ${diagnostics.length} parse diagnostics`,
      );
    }

    return ir;
  }

  private runIncrementalAnalysis(
    repoPath: string,
    snapshotId: string,
    previousIr: IrProject,
    diff: FileDiff,
    totalFiles: number,
  ): IrBuildOutcome {
    const changedFiles = [...diff.added, ...diff.modified];
    const changedPaths = changedFiles.map((file) => join(repoPath, file));
    const groups = this.languageDetector.detectMany(changedPaths);
    const parseResults = this.parseFileGroups(groups);

    const { ir: partialIr, diagnostics } = this.irBuilder.build(parseResults, {
      projectName: previousIr.name,
      rootPath: repoPath,
    });

    if (diagnostics.length > 0) {
      this.logger.warn(
        `Incremental analysis for snapshot ${snapshotId} produced ${diagnostics.length} parse diagnostics`,
      );
    }

    const ir = this.mergeIr(previousIr, partialIr, new Set(diff.unchanged), repoPath);
    const reuseRatio = totalFiles > 0 ? diff.unchanged.length / totalFiles : null;

    this.logger.log(
      `Incremental analysis for snapshot ${snapshotId}: re-parsed ${changedFiles.length} file(s), reused ${diff.unchanged.length}/${totalFiles} (reuseRatio=${reuseRatio})`,
    );

    return { ir, reuseRatio };
  }

  private mergeIr(
    previousIr: IrProject,
    partialIr: IrProject,
    unchangedRelativePaths: ReadonlySet<string>,
    currentRootPath: string,
  ): IrProject {
    const previousModules = previousIr.packages.flatMap((pkg) => pkg.modules);
    const partialModules = partialIr.packages.flatMap((pkg) => pkg.modules);

    const keptModules = previousModules
      .filter((module) =>
        unchangedRelativePaths.has(this.toRepoRelativePath(module.path, previousIr.rootPath)),
      )
      .map((module) => this.rebaseModule(module, previousIr.rootPath, currentRootPath));

    const keptModuleFqns = new Set(keptModules.map((module) => module.fqn));
    const mergedModules = [...keptModules, ...partialModules];

    const pathToFqn = new Map<string, string>();

    for (const module of mergedModules) {
      pathToFqn.set(this.normalizeModulePath(module.path), module.fqn);
    }

    const partialFqnToPath = new Map(partialModules.map((module) => [module.fqn, module.path]));

    const dependencies: IrDependencyProps[] = [];
    const seenDependencies = new Set<string>();

    for (const dependency of previousIr.dependencies) {
      if (!keptModuleFqns.has(dependency.source)) {
        continue;
      }

      const key = `${dependency.source}|${dependency.target}|${dependency.type}`;

      if (!seenDependencies.has(key)) {
        seenDependencies.add(key);
        dependencies.push({
          source: dependency.source,
          target: dependency.target,
          type: dependency.type,
        });
      }
    }

    for (const dependency of partialIr.dependencies) {
      const sourcePath = partialFqnToPath.get(dependency.source) ?? null;
      const target =
        sourcePath !== null && dependency.target.startsWith('.')
          ? this.resolveImportTarget(dependency.target, sourcePath, pathToFqn)
          : dependency.target;
      const key = `${dependency.source}|${target}|${dependency.type}`;

      if (!seenDependencies.has(key)) {
        seenDependencies.add(key);
        dependencies.push({ source: dependency.source, target, type: dependency.type });
      }
    }

    const relationships: IrRelationshipProps[] = [];
    const seenRelationships = new Set<string>();

    for (const relationship of previousIr.relationships) {
      if (!keptModuleFqns.has(this.sourceModuleFqn(relationship.from))) {
        continue;
      }

      const key = `${relationship.kind}|${relationship.from}|${relationship.to}`;

      if (!seenRelationships.has(key)) {
        seenRelationships.add(key);
        relationships.push({
          kind: relationship.kind,
          from: relationship.from,
          to: relationship.to,
        });
      }
    }

    for (const relationship of partialIr.relationships) {
      const key = `${relationship.kind}|${relationship.from}|${relationship.to}`;

      if (!seenRelationships.has(key)) {
        seenRelationships.add(key);
        relationships.push({
          kind: relationship.kind,
          from: relationship.from,
          to: relationship.to,
        });
      }
    }

    return IrProject.create({
      name: previousIr.name,
      rootPath: currentRootPath,
      language: previousIr.language,
      packages: [{ name: 'default', modules: mergedModules.map((module) => module.toJSON()) }],
      dependencies,
      relationships,
    });
  }

  private walkSourceFiles(repoPath: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(repoPath, { recursive: true, withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const absolutePath = join(entry.parentPath, entry.name);
      const segments = absolutePath.split(/[\\/]+/);

      if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) {
        continue;
      }

      files.push(absolutePath);
    }

    return files;
  }

  private parseFileGroups(groups: Map<Language, string[]>): ParseResult[] {
    const parseResults: ParseResult[] = [];

    for (const [language, files] of groups) {
      const parser = this.parserRegistry.get(language.name);

      for (const filePath of files) {
        const content = readFileSync(filePath, 'utf8');
        parseResults.push(parser.parse(ParsedFile.create({ path: filePath, content, language })));
      }
    }

    return parseResults;
  }

  private toRepoRelativePath(absolutePath: string, rootPath: string): string {
    return relative(rootPath, absolutePath);
  }

  private rebaseModule(
    module: IrModule,
    previousRootPath: string,
    currentRootPath: string,
  ): IrModule {
    const props = module.toJSON();

    return IrModule.create(this.packageFqnOf(module.fqn), {
      ...props,
      path: join(currentRootPath, this.toRepoRelativePath(module.path, previousRootPath)),
    });
  }

  private packageFqnOf(moduleFqn: string): string {
    const lastSeparator = moduleFqn.lastIndexOf(':');

    return lastSeparator > 0 ? moduleFqn.slice(0, lastSeparator) : moduleFqn;
  }

  private sourceModuleFqn(nodeFqn: string): string {
    const hashIndex = nodeFqn.indexOf('#');

    return hashIndex >= 0 ? nodeFqn.slice(0, hashIndex) : nodeFqn;
  }

  private resolveImportTarget(
    specifier: string,
    sourceFilePath: string,
    pathToFqn: Map<string, string>,
  ): string {
    const sourceDir = posix.dirname(sourceFilePath);
    const resolved = posix.normalize(posix.join(sourceDir, specifier));

    return pathToFqn.get(this.normalizeModulePath(resolved)) ?? specifier;
  }

  private normalizeModulePath(filePath: string): string {
    return filePath.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '');
  }
}
