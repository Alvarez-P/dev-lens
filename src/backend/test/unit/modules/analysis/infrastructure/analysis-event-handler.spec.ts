import { AnalysisEventHandler } from '@/modules/analysis/infrastructure/events/analysis-event-handler';
import { ANALYSIS_QUEUE } from '@/modules/analysis/analysis.tokens';
import {
  RepositorySynchronizedEvent,
  RepositorySyncStartedEvent,
} from '@/modules/repositories/domain';

describe('AnalysisEventHandler', () => {
  let handler: AnalysisEventHandler;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    handler = new AnalysisEventHandler(queue as never);
  });

  it('should enqueue an analysis job for a repository.synchronized event', async () => {
    const event = new RepositorySynchronizedEvent('repo-1', 'snap-1', 'abc123', 'repo-1');

    await handler.handle(event);

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [jobName, data, options] = queue.add.mock.calls[0] as [
      string,
      { snapshotId: string; repositoryId: string },
      Record<string, unknown>,
    ];
    expect(jobName).toBe('analyze');
    expect(data).toEqual({ snapshotId: 'snap-1', repositoryId: 'repo-1' });
    expect(options).toEqual(
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });

  it('should ignore events of other types', async () => {
    const event = new RepositorySyncStartedEvent('repo-1', 'repo-1');

    await handler.handle(event);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should expose the queue name constant used by the module', () => {
    expect(ANALYSIS_QUEUE).toBe('analysis');
  });
});
