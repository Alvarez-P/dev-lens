import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DOC_TYPE_LABELS,
  DOC_FORMAT_LABELS,
  DOC_FORMAT_EXT,
  downloadFilenameFor,
  formatGeneratedDate,
  groupArtifactsByDocType,
  listDocs,
  generateDocs,
  getDocJob,
  fetchDocText,
  parseProgressStage,
} from '../documentation';
import { get, post } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  get: vi.fn(),
  post: vi.fn(),
  isSuccessResponse: vi.fn((response: unknown) => {
    return (
      typeof response === 'object' &&
      response !== null &&
      'success' in response &&
      (response as { success: boolean }).success === true
    );
  }),
}));

const getMock = vi.mocked(get);
const postMock = vi.mocked(post);

const artifact = (
  overrides: Partial<Parameters<typeof groupArtifactsByDocType>[0][number]> = {},
) => ({
  id: 'doc-1',
  docType: 'readme' as const,
  format: 'markdown' as const,
  sizeBytes: 1024,
  generatedAt: '2026-08-10T12:00:00.000Z',
  templateVersion: '1',
  commitSha: 'abc123',
  ...overrides,
});

describe('documentation lib — display helpers', () => {
  it('maps doc types to human-readable labels', () => {
    expect(DOC_TYPE_LABELS.readme).toBe('README');
    expect(DOC_TYPE_LABELS['architecture-guide']).toBe('Architecture Guide');
    expect(DOC_TYPE_LABELS['api-reference']).toBe('API Reference');
    expect(DOC_TYPE_LABELS['module-docs']).toBe('Module Documentation');
    expect(DOC_TYPE_LABELS['onboarding-guide']).toBe('Onboarding Guide');
  });

  it('maps formats to labels and file extensions', () => {
    expect(DOC_FORMAT_LABELS.markdown).toBe('Markdown');
    expect(DOC_FORMAT_LABELS.openapi).toBe('OpenAPI');
    expect(DOC_FORMAT_EXT.markdown).toBe('md');
    expect(DOC_FORMAT_EXT.openapi).toBe('openapi.json');
  });

  it('builds the download filename as {docType}.{ext}', () => {
    expect(downloadFilenameFor('readme', 'markdown')).toBe('readme.md');
    expect(downloadFilenameFor('api-reference', 'openapi')).toBe('api-reference.openapi.json');
  });

  it('formats generated dates like "Aug 10, 2026"', () => {
    expect(formatGeneratedDate('2026-08-10T12:00:00.000Z')).toMatch(/Aug 10, 2026/);
  });

  it('returns "Never" for missing dates', () => {
    expect(formatGeneratedDate(null)).toBe('Never');
  });
});

describe('documentation lib — grouping', () => {
  it('groups artifacts by docType and keeps the newest first', () => {
    const grouped = groupArtifactsByDocType([
      artifact({ id: 'old', generatedAt: '2026-01-01T00:00:00.000Z' }),
      artifact({ id: 'new', generatedAt: '2026-08-10T00:00:00.000Z' }),
      artifact({ id: 'api', docType: 'api-reference', format: 'openapi' }),
    ]);

    expect([...grouped.keys()].sort()).toEqual(['api-reference', 'readme']);
    expect(grouped.get('readme')?.map((a) => a.id)).toEqual(['new', 'old']);
    expect(grouped.get('api-reference')).toHaveLength(1);
  });
});

describe('documentation lib — API calls', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('listDocs maps the success envelope to the artifact array', async () => {
    getMock.mockResolvedValue({ success: true, data: [artifact()] });
    const docs = await listDocs('repo-1');
    expect(getMock).toHaveBeenCalledWith('/api/v1/repositories/repo-1/docs');
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ docType: 'readme', format: 'markdown' });
  });

  it('listDocs returns an empty array on an empty envelope', async () => {
    getMock.mockResolvedValue({ success: true, data: [] });
    await expect(listDocs('repo-1')).resolves.toEqual([]);
  });

  it('generateDocs posts and returns the job id', async () => {
    postMock.mockResolvedValue({ jobId: 'job-1' });
    const jobId = await generateDocs('repo-1', ['readme']);
    expect(postMock).toHaveBeenCalledWith('/api/v1/repositories/repo-1/docs/generate', {
      docTypes: ['readme'],
    });
    expect(jobId).toBe('job-1');
  });

  it('generateDocs omits docTypes when not provided', async () => {
    postMock.mockResolvedValue({ jobId: 'job-1' });
    await generateDocs('repo-1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/repositories/repo-1/docs/generate', undefined);
  });

  it('getDocJob returns the job status envelope', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: { jobId: 'job-1', state: 'active', progress: 40, failedReason: null },
    });
    const job = await getDocJob('repo-1', 'job-1');
    expect(getMock).toHaveBeenCalledWith('/api/v1/repositories/repo-1/docs/jobs/job-1');
    expect(job).toMatchObject({ state: 'active', progress: 40 });
  });

  it('fetchDocText reads the raw download body with auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '# Hello' });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => 'tok' });
    const text = await fetchDocText('repo-1', 'doc-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/repositories/repo-1/docs/doc-1/download',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
    expect(text).toBe('# Hello');
    vi.unstubAllGlobals();
  });
});

describe('documentation lib — progress stages', () => {
  it('maps progress percentages to pipeline stages', () => {
    expect(parseProgressStage(20)).toMatch(/templates/i);
    expect(parseProgressStage(40)).toMatch(/content/i);
    expect(parseProgressStage(100)).toMatch(/storing/i);
  });

  it('falls back to a generic label for unknown progress', () => {
    expect(parseProgressStage(7)).toBeTruthy();
  });
});
