import { KnowledgeGraphEventHandler } from '@/modules/knowledge-graph/infrastructure/events/knowledge-graph-event-handler';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/analysis-events';
import { RepositorySynchronizedEvent } from '@/modules/repositories/domain';

describe('KnowledgeGraphEventHandler', () => {
  const graphQueue = { add: jest.fn() };

  let handler: KnowledgeGraphEventHandler;

  beforeEach(() => {
    graphQueue.add.mockReset();
    graphQueue.add.mockResolvedValue(undefined);
    handler = new KnowledgeGraphEventHandler(graphQueue as never);
  });

  it('should enqueue a knowledge-graph job when an analysis.completed event arrives', async () => {
    const event = new AnalysisCompletedEvent('snap-1', 'repo-1', null, 'corr-1', 'analysis-1');

    await handler.handle(event);

    expect(graphQueue.add).toHaveBeenCalledTimes(1);
    expect(graphQueue.add).toHaveBeenCalledWith(
      'build-graph',
      { analysisId: 'analysis-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );
  });

  it('should ignore events that are not analysis.completed', async () => {
    const event = new RepositorySynchronizedEvent('repo-1', 'snap-1', 'abc123', 'corr-1');

    await handler.handle(event);

    expect(graphQueue.add).not.toHaveBeenCalled();
  });
});
