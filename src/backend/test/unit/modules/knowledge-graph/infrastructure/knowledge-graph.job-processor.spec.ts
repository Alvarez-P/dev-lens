import { KnowledgeGraphJobProcessor } from '@/modules/knowledge-graph/infrastructure/jobs/knowledge-graph.job-processor';

describe('KnowledgeGraphJobProcessor', () => {
  const buildGraph = jest.fn();
  const deadLetterQueue = { add: jest.fn() };

  let processor: KnowledgeGraphJobProcessor;

  beforeEach(() => {
    buildGraph.mockReset();
    deadLetterQueue.add.mockReset();
    processor = new KnowledgeGraphJobProcessor({ buildGraph } as never, deadLetterQueue as never);
  });

  it('should build the graph for the analysis id in the job payload', async () => {
    const job = {
      data: { analysisId: 'analysis-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      id: 'job-1',
    } as never;

    await processor.process(job);

    expect(buildGraph).toHaveBeenCalledTimes(1);
    expect(buildGraph).toHaveBeenCalledWith('analysis-1');
  });

  it('should route the job to the dead letter queue once all retry attempts are exhausted', async () => {
    buildGraph.mockRejectedValue(new Error('persistent failure'));
    const job = {
      data: { analysisId: 'analysis-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
      id: 'job-1',
    } as never;

    await expect(processor.process(job)).rejects.toThrow('persistent failure');

    expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'knowledge-graph-failed',
      { analysisId: 'analysis-1' },
      { jobId: 'job-1' },
    );
  });

  it('should rethrow without routing to the dead letter queue while retries remain', async () => {
    buildGraph.mockRejectedValue(new Error('transient failure'));
    const job = {
      data: { analysisId: 'analysis-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      id: 'job-1',
    } as never;

    await expect(processor.process(job)).rejects.toThrow('transient failure');

    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });
});
