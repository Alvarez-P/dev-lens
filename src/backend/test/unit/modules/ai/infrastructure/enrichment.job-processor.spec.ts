import { EnrichmentJobProcessor } from '@/modules/ai/infrastructure/jobs/enrichment.job-processor';

describe('EnrichmentJobProcessor (REQ-EP-002)', () => {
  const run = jest.fn();
  const deadLetterQueue = { add: jest.fn() };

  let processor: EnrichmentJobProcessor;

  beforeEach(() => {
    run.mockReset();
    deadLetterQueue.add.mockReset();
    processor = new EnrichmentJobProcessor({ run } as never, deadLetterQueue as never);
  });

  const job = {
    data: { analysisId: 'analysis-1' },
    attemptsMade: 0,
    opts: { attempts: 3 },
    id: 'job-1',
  } as never;

  it('should run the enrichment service for the job payload', async () => {
    run.mockResolvedValue(undefined);

    await processor.process(job);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ analysisId: 'analysis-1' }, { finalAttempt: false });
  });

  it('should route the job to the dead letter queue once all retry attempts are exhausted', async () => {
    run.mockRejectedValue(new Error('persistent failure'));
    const finalJob = {
      data: { analysisId: 'analysis-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
      id: 'job-1',
    } as never;

    await expect(processor.process(finalJob)).rejects.toThrow('persistent failure');

    expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'enrichment-failed',
      { analysisId: 'analysis-1' },
      { jobId: 'job-1' },
    );
  });

  it('should pass finalAttempt=true on the last attempt', async () => {
    run.mockRejectedValue(new Error('transient'));
    const finalJob = {
      data: { analysisId: 'analysis-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
      id: 'job-1',
    } as never;

    await expect(processor.process(finalJob)).rejects.toThrow('transient');

    expect(run).toHaveBeenCalledWith({ analysisId: 'analysis-1' }, { finalAttempt: true });
  });

  it('should rethrow without routing to the dead letter queue while retries remain', async () => {
    run.mockRejectedValue(new Error('transient failure'));

    await expect(processor.process(job)).rejects.toThrow('transient failure');

    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });
});
