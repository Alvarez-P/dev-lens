import { DocumentationJobProcessor } from '@/modules/documentation/infrastructure/jobs/documentation.job-processor';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';

describe('DocumentationJobProcessor (6.2)', () => {
  const documentationService = { generate: jest.fn() };
  const repositoryRepository = { findById: jest.fn() };
  const deadLetterQueue = { add: jest.fn() };

  let processor: DocumentationJobProcessor;

  beforeEach(() => {
    documentationService.generate.mockReset();
    documentationService.generate.mockResolvedValue({
      repositoryId: 'repo-1',
      commitSha: 'abc123',
      generated: [DocType.README],
      skipped: [],
    });
    repositoryRepository.findById.mockReset();
    repositoryRepository.findById.mockResolvedValue({
      id: { toString: () => 'repo-1' },
      organizationId: null,
      workspaceId: null,
      ownerId: 'owner-1',
    });
    deadLetterQueue.add.mockReset();
    deadLetterQueue.add.mockResolvedValue(undefined);
    processor = new DocumentationJobProcessor(
      documentationService as never,
      repositoryRepository as never,
      deadLetterQueue as never,
    );
  });

  it('should generate documentation with the job payload and the resolved repository ref', async () => {
    const job = {
      data: { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      id: 'job-1',
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as never;

    await processor.process(job);

    expect(repositoryRepository.findById).toHaveBeenCalledTimes(1);
    expect(documentationService.generate).toHaveBeenCalledTimes(1);
    const [repoId, analysisId, options] = documentationService.generate.mock.calls[0];
    expect(repoId).toBe('repo-1');
    expect(analysisId).toBe('analysis-1');
    expect(options.repository).toEqual({
      id: 'repo-1',
      organizationId: null,
      workspaceId: null,
      ownerId: 'owner-1',
    });
  });

  it('should pass docTypes and force through to the service', async () => {
    const job = {
      data: {
        repositoryId: 'repo-1',
        analysisId: 'analysis-1',
        docTypes: [DocType.README, DocType.API_REFERENCE],
        force: true,
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
      id: 'job-1',
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as never;

    await processor.process(job);

    const [, , options] = documentationService.generate.mock.calls[0];
    expect(options.docTypes).toEqual([DocType.README, DocType.API_REFERENCE]);
    expect(options.force).toBe(true);
  });

  it('should report progress to BullMQ via job.updateProgress (start 0 + per-stage)', async () => {
    const updateProgress = jest.fn().mockResolvedValue(undefined);
    documentationService.generate.mockImplementation(async (_repoId, _analysisId, options) => {
      options?.onProgress?.('template-select', 20);
      options?.onProgress?.('render', 80);
      return { repositoryId: 'repo-1', commitSha: 'abc123', generated: [], skipped: [] };
    });
    const job = {
      data: { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      id: 'job-1',
      updateProgress,
    } as never;

    await processor.process(job);

    expect(updateProgress).toHaveBeenCalledWith(0);
    expect(updateProgress).toHaveBeenCalledWith(20);
    expect(updateProgress).toHaveBeenCalledWith(80);
  });

  it('should route the job to the dead letter queue once all retry attempts are exhausted', async () => {
    documentationService.generate.mockRejectedValue(new Error('persistent failure'));
    const job = {
      data: { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
      id: 'job-1',
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as never;

    await expect(processor.process(job)).rejects.toThrow('persistent failure');

    expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'documentation-failed',
      { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      { jobId: 'job-1' },
    );
  });

  it('should rethrow without routing to the dead letter queue while retries remain', async () => {
    documentationService.generate.mockRejectedValue(new Error('transient failure'));
    const job = {
      data: { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      id: 'job-1',
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as never;

    await expect(processor.process(job)).rejects.toThrow('transient failure');

    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });
});
