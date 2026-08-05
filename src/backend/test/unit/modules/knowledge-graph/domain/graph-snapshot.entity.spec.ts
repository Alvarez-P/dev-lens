import {
  GraphSnapshot,
  GraphSnapshotId,
} from '@/modules/knowledge-graph/domain/graph-snapshot.entity';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';

describe('GraphSnapshot aggregate', () => {
  describe('create', () => {
    it('should create a snapshot in PENDING status with zero counts', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');

      expect(snapshot.id).toBeInstanceOf(GraphSnapshotId);
      expect(snapshot.repoId).toBe('repo-1');
      expect(snapshot.analysisId).toBe('analysis-1');
      expect(snapshot.commitSha).toBe('abc123');
      expect(snapshot.nodeCount).toBe(0);
      expect(snapshot.edgeCount).toBe(0);
      expect(snapshot.status).toBe(BuildStatus.PENDING);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.domainEvents).toEqual([]);
    });
  });

  describe('startBuilding', () => {
    it('should move from PENDING to BUILDING', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');

      snapshot.startBuilding();

      expect(snapshot.status).toBe(BuildStatus.BUILDING);
    });

    it('should throw when starting building from a non-PENDING status', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
      snapshot.startBuilding();

      expect(() => snapshot.startBuilding()).toThrow(
        'Graph snapshot can only start building from PENDING status',
      );
    });
  });

  describe('complete', () => {
    it('should move to BUILT with persisted counts', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
      snapshot.startBuilding();

      snapshot.complete(42, 58);

      expect(snapshot.status).toBe(BuildStatus.BUILT);
      expect(snapshot.nodeCount).toBe(42);
      expect(snapshot.edgeCount).toBe(58);
    });

    it('should throw when completing from a non-BUILDING status', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');

      expect(() => snapshot.complete(42, 58)).toThrow(
        'Graph snapshot can only complete from BUILDING status',
      );
    });

    it('should reject negative counts', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
      snapshot.startBuilding();

      expect(() => snapshot.complete(-1, 58)).toThrow('Graph snapshot counts must not be negative');
    });
  });

  describe('fail', () => {
    it('should move to FAILED from PENDING', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');

      snapshot.fail('boom');

      expect(snapshot.status).toBe(BuildStatus.FAILED);
    });

    it('should move to FAILED from BUILDING', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
      snapshot.startBuilding();

      snapshot.fail('boom');

      expect(snapshot.status).toBe(BuildStatus.FAILED);
    });

    it('should throw when failing an already BUILT snapshot', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
      snapshot.startBuilding();
      snapshot.complete(42, 58);

      expect(() => snapshot.fail('boom')).toThrow(
        'Graph snapshot can only fail from PENDING or BUILDING status',
      );
    });

    it('should reject an empty error message', () => {
      const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');

      expect(() => snapshot.fail(' ')).toThrow('Graph snapshot failure error must not be empty');
    });
  });

  describe('reconstitute', () => {
    it('should restore a persisted snapshot in any status', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const snapshot = GraphSnapshot.reconstitute(
        GraphSnapshotId.from('snapshot-1'),
        'repo-1',
        'analysis-1',
        'abc123',
        42,
        58,
        BuildStatus.BUILT,
        createdAt,
      );

      expect(snapshot.id.toString()).toBe('snapshot-1');
      expect(snapshot.status).toBe(BuildStatus.BUILT);
      expect(snapshot.nodeCount).toBe(42);
      expect(snapshot.edgeCount).toBe(58);
      expect(snapshot.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(snapshot.domainEvents).toEqual([]);
    });
  });
});
