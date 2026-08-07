import { DomainEvent } from '@/shared/domain/domain-event';
import {
  EnrichmentStartedEvent,
  EnrichmentCompletedEvent,
  EnrichmentFailedEvent,
  EnrichmentSkippedEvent,
} from '@/modules/ai/domain/ai-events';

describe('EnrichmentStartedEvent', () => {
  it('should expose the enrichment.started event type and identifiers', () => {
    const event = new EnrichmentStartedEvent('analysis-1', 'repo-1', 'snap-1', 'corr-1');

    expect(event.eventType).toBe('enrichment.started');
    expect(event.analysisId).toBe('analysis-1');
    expect(event.repositoryId).toBe('repo-1');
    expect(event.snapshotId).toBe('snap-1');
    expect(event.correlationId).toBe('corr-1');
    expect(event.aggregateId).toBe('analysis-1');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it('should satisfy the DomainEvent interface', () => {
    const event = new EnrichmentStartedEvent('a', 'r', 's', 'c');
    const domainEvent: DomainEvent = event;

    expect(domainEvent.eventType).toBe('enrichment.started');
    expect(domainEvent.aggregateId).toBe('a');
  });
});

describe('EnrichmentCompletedEvent', () => {
  it('should include unit counts for full or partial success', () => {
    const event = new EnrichmentCompletedEvent('analysis-1', 'repo-1', 'snap-1', 'corr-1', 10, 2);

    expect(event.eventType).toBe('enrichment.completed');
    expect(event.unitCount).toBe(10);
    expect(event.failedUnitCount).toBe(2);
    expect(event.correlationId).toBe('corr-1');
    expect(event.aggregateId).toBe('analysis-1');
  });
});

describe('EnrichmentFailedEvent', () => {
  it('should carry a failure reason and unit counts', () => {
    const event = new EnrichmentFailedEvent(
      'analysis-1',
      'repo-1',
      'snap-1',
      'corr-1',
      10,
      10,
      'provider_unavailable',
    );

    expect(event.eventType).toBe('enrichment.failed');
    expect(event.reason).toBe('provider_unavailable');
    expect(event.unitCount).toBe(10);
    expect(event.failedUnitCount).toBe(10);
    expect(event.aggregateId).toBe('analysis-1');
  });
});

describe('EnrichmentSkippedEvent', () => {
  it('should carry the skip reason', () => {
    const event = new EnrichmentSkippedEvent(
      'analysis-1',
      'repo-1',
      'snap-1',
      'corr-1',
      'manifest_unchanged',
    );

    expect(event.eventType).toBe('enrichment.skipped');
    expect(event.reason).toBe('manifest_unchanged');
    expect(event.analysisId).toBe('analysis-1');
    expect(event.aggregateId).toBe('analysis-1');
  });
});
