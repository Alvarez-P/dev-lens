import { AnalysisJobProcessor } from '@/modules/analysis/infrastructure/jobs/analysis.job-processor';
import { StaticAnalysisService } from '@/modules/analysis/application/static-analysis.service';

interface MockJob {
  data: { snapshotId: string; repositoryId: string };
  attemptsMade: number;
  opts: { attempts?: number };
  id?: string;
}

function job(overrides: Partial<MockJob> = {}): MockJob {
  return {
    data: { snapshotId: 'snap-1', repositoryId: 'repo-1' },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  };
}

describe('AnalysisJobProcessor', () => {
  let processor: AnalysisJobProcessor;
  let staticAnalysisService: { analyze: jest.Mock };
  let deadLetterQueue: { add: jest.Mock };

  beforeEach(() => {
    staticAnalysisService = { analyze: jest.fn().mockResolvedValue(undefined) };
    deadLetterQueue = { add: jest.fn().mockResolvedValue(undefined) };
    processor = new AnalysisJobProcessor(
      staticAnalysisService as unknown as StaticAnalysisService,
      deadLetterQueue as never,
    );
  });

  it('should delegate to the static analysis service', async () => {
    await processor.process(job() as never);

    expect(staticAnalysisService.analyze).toHaveBeenCalledWith({
      snapshotId: 'snap-1',
      repositoryId: 'repo-1',
    });
    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });

  it('should rethrow on failure so BullMQ retries, without sending to the DLQ before the final attempt', async () => {
    staticAnalysisService.analyze.mockRejectedValue(new Error('transient failure'));

    await expect(processor.process(job({ attemptsMade: 1 }) as never)).rejects.toThrow(
      'transient failure',
    );

    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });

  it('should move the job to the dead-letter queue after the final retry attempt', async () => {
    staticAnalysisService.analyze.mockRejectedValue(new Error('permanent failure'));

    await expect(processor.process(job({ attemptsMade: 2, id: 'job-1' }) as never)).rejects.toThrow(
      'permanent failure',
    );

    expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, data, options] = deadLetterQueue.add.mock.calls[0] as [
      string,
      unknown,
      Record<string, unknown>,
    ];
    expect(jobName).toBe('analysis-failed');
    expect(data).toEqual({ snapshotId: 'snap-1', repositoryId: 'repo-1' });
    expect(options).toEqual({ jobId: 'job-1' });
  });
});
