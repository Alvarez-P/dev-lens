import { Analysis } from '@/modules/analysis/domain/analysis.entity';
import { AnalysisStatus } from '@/modules/analysis/domain/analysis-status.enum';
import { AnalysisId } from '@/modules/analysis/domain/analysis-id.vo';
import { FrameworkCandidate } from '@/modules/analysis/domain/framework-candidate.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { Language } from '@/modules/analysis/domain/language.vo';
import { SnapshotId, RepositoryId } from '@/modules/repositories/domain';

const typescript = Language.create('typescript', '.ts');

function sampleIr(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: typescript,
    packages: [
      {
        name: 'core',
        modules: [{ name: 'src/app', path: '/repo/src/app.ts' }],
      },
    ],
  });
}

function sampleManifest(): Record<string, string> {
  return { '/repo/src/app.ts': 'abc123' };
}

function sampleCandidates(): FrameworkCandidate[] {
  return [
    FrameworkCandidate.create({
      framework: 'nestjs',
      file: 'package.json',
      markers: ['@nestjs/core'],
    }),
  ];
}

describe('Analysis aggregate', () => {
  const snapshotId = SnapshotId.from('snap-1');
  const repositoryId = RepositoryId.from('repo-1');

  describe('create', () => {
    it('should create a PENDING analysis with null ir and manifest', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);

      expect(analysis.id).toBeInstanceOf(AnalysisId);
      expect(analysis.snapshotId).toBe(snapshotId);
      expect(analysis.repositoryId).toBe(repositoryId);
      expect(analysis.status).toBe(AnalysisStatus.PENDING);
      expect(analysis.ir).toBeNull();
      expect(analysis.fileManifest).toBeNull();
      expect(analysis.reuseRatio).toBeNull();
      expect(analysis.frameworkCandidates).toBeNull();
      expect(analysis.createdAt).toBeInstanceOf(Date);
      expect(analysis.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('startProcessing', () => {
    it('should move to PROCESSING and emit an AnalysisStartedEvent', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);

      analysis.startProcessing('ws-1', 'corr-1');

      expect(analysis.status).toBe(AnalysisStatus.PROCESSING);
      expect(analysis.domainEvents).toHaveLength(1);
      expect(analysis.domainEvents[0].eventType).toBe('analysis.started');
      expect(analysis.domainEvents[0].aggregateId).toBe('snap-1');
    });

    it('should throw when starting processing from a non-PENDING status', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing(null, 'corr-1');

      expect(() => analysis.startProcessing(null, 'corr-2')).toThrow(
        'Analysis can only start processing from PENDING status',
      );
    });
  });

  describe('completeProcessing', () => {
    it('should complete with ir and manifest and emit an AnalysisCompletedEvent', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');

      analysis.completeProcessing(sampleIr(), sampleManifest(), 'ws-1', 'corr-1');

      expect(analysis.status).toBe(AnalysisStatus.COMPLETED);
      expect(analysis.ir).not.toBeNull();
      expect(analysis.ir!.fqn).toBe('acme');
      expect(analysis.fileManifest).toEqual(sampleManifest());

      const completedEvent = analysis.domainEvents.find(
        (event) => event.eventType === 'analysis.completed',
      );
      expect(completedEvent).toBeDefined();
      expect(completedEvent!.aggregateId).toBe(analysis.id.toString());
    });

    it('should throw when completing from a non-PROCESSING status', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);

      expect(() =>
        analysis.completeProcessing(sampleIr(), sampleManifest(), 'ws-1', 'corr-1'),
      ).toThrow('Analysis can only complete processing from PROCESSING status');
    });

    it('should store the reuse ratio when completing an incremental run', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');

      analysis.completeProcessing(sampleIr(), sampleManifest(), 'ws-1', 'corr-1', 0.8);

      expect(analysis.status).toBe(AnalysisStatus.COMPLETED);
      expect(analysis.reuseRatio).toBe(0.8);
    });

    it('should default the reuse ratio to null on a full run', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');

      analysis.completeProcessing(sampleIr(), sampleManifest(), 'ws-1', 'corr-1');

      expect(analysis.reuseRatio).toBeNull();
    });

    it('should store framework candidates when completing with candidates', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');

      analysis.completeProcessing(
        sampleIr(),
        sampleManifest(),
        'ws-1',
        'corr-1',
        null,
        sampleCandidates(),
      );

      expect(analysis.frameworkCandidates).toEqual(sampleCandidates());
    });

    it('should default framework candidates to null when completing without candidates', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');

      analysis.completeProcessing(sampleIr(), sampleManifest(), 'ws-1', 'corr-1');

      expect(analysis.frameworkCandidates).toBeNull();
    });
  });

  describe('failProcessing', () => {
    it('should move to FAILED and emit an AnalysisFailedEvent', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');

      analysis.failProcessing('boom', 'ws-1', 'corr-1');

      expect(analysis.status).toBe(AnalysisStatus.FAILED);

      const failedEvent = analysis.domainEvents.find(
        (event) => event.eventType === 'analysis.failed',
      );
      expect(failedEvent).toBeDefined();
    });

    it('should throw when failing an already completed analysis', () => {
      const analysis = Analysis.create(snapshotId, repositoryId);
      analysis.startProcessing('ws-1', 'corr-1');
      analysis.completeProcessing(sampleIr(), sampleManifest(), 'ws-1', 'corr-1');

      expect(() => analysis.failProcessing('boom', 'ws-1', 'corr-1')).toThrow(
        'Analysis can only fail from PENDING or PROCESSING status',
      );
    });
  });

  describe('reconstitute', () => {
    it('should restore a persisted analysis with ir and manifest', () => {
      const analysis = Analysis.reconstitute(
        AnalysisId.from('analysis-1'),
        snapshotId,
        repositoryId,
        AnalysisStatus.COMPLETED,
        sampleIr(),
        sampleManifest(),
        0.75,
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-02T00:00:00Z'),
      );

      expect(analysis.id.toString()).toBe('analysis-1');
      expect(analysis.status).toBe(AnalysisStatus.COMPLETED);
      expect(analysis.ir!.packages[0].modules[0].fqn).toBe('acme:core:src/app');
      expect(analysis.fileManifest).toEqual(sampleManifest());
      expect(analysis.reuseRatio).toBe(0.75);
      expect(analysis.frameworkCandidates).toBeNull();
      expect(analysis.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(analysis.updatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
      expect(analysis.domainEvents).toEqual([]);
    });

    it('should restore framework candidates from a persisted analysis', () => {
      const analysis = Analysis.reconstitute(
        AnalysisId.from('analysis-1'),
        snapshotId,
        repositoryId,
        AnalysisStatus.COMPLETED,
        sampleIr(),
        sampleManifest(),
        0.75,
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-02T00:00:00Z'),
        sampleCandidates(),
      );

      expect(analysis.frameworkCandidates).toEqual(sampleCandidates());
    });
  });
});
