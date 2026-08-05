import {
  GraphBuiltEvent,
  GraphUpdatedEvent,
  GraphBuildFailedEvent,
} from '@/modules/knowledge-graph/domain/graph-events';

describe('GraphBuiltEvent', () => {
  it('should expose the knowledge-graph.built event type and identifiers', () => {
    const event = new GraphBuiltEvent('repo-1', 'snapshot-1', 'analysis-1');

    expect(event.eventType).toBe('knowledge-graph.built');
    expect(event.repositoryId).toBe('repo-1');
    expect(event.snapshotId).toBe('snapshot-1');
    expect(event.analysisId).toBe('analysis-1');
    expect(event.aggregateId).toBe('snapshot-1');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.timestamp).toBeInstanceOf(Date);
  });
});

describe('GraphUpdatedEvent', () => {
  it('should expose the knowledge-graph.updated event type and identifiers', () => {
    const event = new GraphUpdatedEvent('repo-1', 'snapshot-2', 'analysis-2');

    expect(event.eventType).toBe('knowledge-graph.updated');
    expect(event.repositoryId).toBe('repo-1');
    expect(event.snapshotId).toBe('snapshot-2');
    expect(event.analysisId).toBe('analysis-2');
    expect(event.aggregateId).toBe('snapshot-2');
    expect(event.occurredOn).toBeInstanceOf(Date);
  });
});

describe('GraphBuildFailedEvent', () => {
  it('should expose the knowledge-graph.build-failed event type, identifiers, and error', () => {
    const event = new GraphBuildFailedEvent('repo-1', 'snapshot-3', 'analysis-3', 'boom');

    expect(event.eventType).toBe('knowledge-graph.build-failed');
    expect(event.repositoryId).toBe('repo-1');
    expect(event.snapshotId).toBe('snapshot-3');
    expect(event.analysisId).toBe('analysis-3');
    expect(event.error).toBe('boom');
    expect(event.aggregateId).toBe('snapshot-3');
    expect(event.occurredOn).toBeInstanceOf(Date);
  });
});
