import {
  AnalysisStartedEvent,
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
} from '@/modules/analysis/domain/analysis-events';

describe('AnalysisStartedEvent', () => {
  it('should expose the analysis.started event type', () => {
    const event = new AnalysisStartedEvent('snap-1', 'repo-1', 'ws-1', 'corr-1');

    expect(event.eventType).toBe('analysis.started');
    expect(event.snapshotId).toBe('snap-1');
    expect(event.repositoryId).toBe('repo-1');
    expect(event.workspaceId).toBe('ws-1');
    expect(event.correlationId).toBe('corr-1');
    expect(event.aggregateId).toBe('snap-1');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.timestamp).toBeInstanceOf(Date);
  });
});

describe('AnalysisCompletedEvent', () => {
  it('should expose the analysis.completed event type and IR identifier', () => {
    const event = new AnalysisCompletedEvent('snap-1', 'repo-1', 'ws-1', 'corr-1', 'analysis-42');

    expect(event.eventType).toBe('analysis.completed');
    expect(event.analysisId).toBe('analysis-42');
    expect(event.snapshotId).toBe('snap-1');
    expect(event.correlationId).toBe('corr-1');
    expect(event.aggregateId).toBe('analysis-42');
    expect(event.occurredOn).toBeInstanceOf(Date);
  });
});

describe('AnalysisFailedEvent', () => {
  it('should expose the analysis.failed event type and error', () => {
    const event = new AnalysisFailedEvent(
      'snap-1',
      'repo-1',
      'ws-1',
      'corr-1',
      'Parse error at line 3',
    );

    expect(event.eventType).toBe('analysis.failed');
    expect(event.error).toBe('Parse error at line 3');
    expect(event.snapshotId).toBe('snap-1');
    expect(event.correlationId).toBe('corr-1');
    expect(event.aggregateId).toBe('snap-1');
    expect(event.occurredOn).toBeInstanceOf(Date);
  });
});
