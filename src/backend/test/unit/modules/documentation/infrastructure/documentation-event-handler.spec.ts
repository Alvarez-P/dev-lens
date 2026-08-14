import { DocumentationEventHandler } from '@/modules/documentation/infrastructure/events/documentation-event-handler';
import { GraphBuiltEvent, GraphUpdatedEvent } from '@/modules/knowledge-graph/domain/graph-events';
import { RepositorySynchronizedEvent } from '@/modules/repositories/domain';

describe('DocumentationEventHandler (6.1)', () => {
  const documentationQueue = { add: jest.fn() };
  const enabledConfig = { documentation: { enabled: true, aiEnabled: false } };

  let handler: DocumentationEventHandler;

  beforeEach(() => {
    documentationQueue.add.mockReset();
    documentationQueue.add.mockResolvedValue(undefined);
    handler = new DocumentationEventHandler(documentationQueue as never, enabledConfig as never);
  });

  it('should enqueue a documentation job when knowledge-graph.built arrives', async () => {
    const event = new GraphBuiltEvent('repo-1', 'snap-1', 'analysis-1');

    await handler.handle(event);

    expect(documentationQueue.add).toHaveBeenCalledTimes(1);
    expect(documentationQueue.add).toHaveBeenCalledWith(
      'generate-documentation',
      { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );
  });

  it('should enqueue a documentation job when knowledge-graph.updated arrives', async () => {
    const event = new GraphUpdatedEvent('repo-2', 'snap-2', 'analysis-2');

    await handler.handle(event);

    expect(documentationQueue.add).toHaveBeenCalledTimes(1);
    expect(documentationQueue.add).toHaveBeenCalledWith(
      'generate-documentation',
      { repositoryId: 'repo-2', analysisId: 'analysis-2' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('should not enqueue when the DOCUMENTATION_ENABLED flag is off', async () => {
    const disabledHandler = new DocumentationEventHandler(
      documentationQueue as never,
      {
        documentation: { enabled: false, aiEnabled: false },
      } as never,
    );
    const event = new GraphBuiltEvent('repo-1', 'snap-1', 'analysis-1');

    await disabledHandler.handle(event);

    expect(documentationQueue.add).not.toHaveBeenCalled();
  });

  it('should ignore unrelated domain events', async () => {
    const event = new RepositorySynchronizedEvent('repo-1', 'snap-1', 'abc123', 'corr-1');

    await handler.handle(event);

    expect(documentationQueue.add).not.toHaveBeenCalled();
  });
});
