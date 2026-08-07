import { EnrichmentEventHandler } from '@/modules/ai/infrastructure/events/enrichment-event-handler';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/analysis-events';
import { RepositorySynchronizedEvent } from '@/modules/repositories/domain';

describe('EnrichmentEventHandler (REQ-EP-001)', () => {
  const enrichmentQueue = { add: jest.fn() };
  const configService = { ai: { enabled: true } };

  let handler: EnrichmentEventHandler;

  beforeEach(() => {
    enrichmentQueue.add.mockReset();
    enrichmentQueue.add.mockResolvedValue(undefined);
    configService.ai.enabled = true;
    handler = new EnrichmentEventHandler(enrichmentQueue as never, configService as never);
  });

  it('should enqueue an enrichment job with identifiers when ai.enabled is true', async () => {
    const event = new AnalysisCompletedEvent('snap-1', 'repo-1', null, 'corr-1', 'analysis-1');

    await handler.handle(event);

    expect(enrichmentQueue.add).toHaveBeenCalledTimes(1);
    expect(enrichmentQueue.add).toHaveBeenCalledWith(
      'enrich',
      {
        analysisId: 'analysis-1',
        repositoryId: 'repo-1',
        snapshotId: 'snap-1',
        correlationId: 'corr-1',
      },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );
  });

  it('should return immediately without enqueuing when ai.enabled is false', async () => {
    configService.ai.enabled = false;
    const event = new AnalysisCompletedEvent('snap-1', 'repo-1', null, 'corr-1', 'analysis-1');

    await handler.handle(event);

    expect(enrichmentQueue.add).not.toHaveBeenCalled();
  });

  it('should ignore events that are not analysis.completed', async () => {
    const event = new RepositorySynchronizedEvent('repo-1', 'snap-1', 'abc123', 'corr-1');

    await handler.handle(event);

    expect(enrichmentQueue.add).not.toHaveBeenCalled();
  });
});
