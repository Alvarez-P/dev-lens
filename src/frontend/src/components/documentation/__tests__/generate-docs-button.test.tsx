import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GenerateDocsButton } from '../generate-docs-button';
import { generateDocs, getDocJob } from '@/lib/documentation';

vi.mock('@/lib/documentation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/documentation')>();
  return {
    ...actual,
    generateDocs: vi.fn(),
    getDocJob: vi.fn(),
  };
});

const generateDocsMock = vi.mocked(generateDocs);
const getDocJobMock = vi.mocked(getDocJob);

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('GenerateDocsButton (7.4)', () => {
  beforeEach(() => {
    generateDocsMock.mockReset();
    getDocJobMock.mockReset();
    vi.useRealTimers();
  });

  it('shows the button in the idle state', () => {
    renderWithQuery(<GenerateDocsButton repoId="repo-1" />);
    expect(screen.getByRole('button', { name: /generate documentation/i })).toBeInTheDocument();
  });

  it('posts generate and replaces the button with a progress indicator (R5)', async () => {
    generateDocsMock.mockResolvedValue('job-1');
    getDocJobMock.mockResolvedValue({
      jobId: 'job-1',
      state: 'active',
      progress: 40,
      failedReason: null,
    });

    renderWithQuery(<GenerateDocsButton repoId="repo-1" />);
    fireEvent.click(screen.getByRole('button', { name: /generate documentation/i }));

    await waitFor(() => {
      expect(generateDocsMock).toHaveBeenCalledWith('repo-1', undefined);
    });

    const progress = await screen.findByTestId('generation-progress');
    expect(progress).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /generate documentation/i }),
    ).not.toBeInTheDocument();

    // The job endpoint is polled for status.
    await waitFor(() => {
      expect(getDocJobMock).toHaveBeenCalledWith('repo-1', 'job-1');
    });
  });

  it('returns to the button and notifies onSettled when the job completes', async () => {
    generateDocsMock.mockResolvedValue('job-1');
    getDocJobMock.mockResolvedValue({
      jobId: 'job-1',
      state: 'completed',
      progress: 100,
      failedReason: null,
    });

    const onSettled = vi.fn();
    renderWithQuery(<GenerateDocsButton repoId="repo-1" onSettled={onSettled} />);
    fireEvent.click(screen.getByRole('button', { name: /generate documentation/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate documentation/i })).toBeInTheDocument();
    });
    expect(onSettled).toHaveBeenCalled();
  });

  it('shows the failure reason and a retry button when the job fails', async () => {
    generateDocsMock.mockResolvedValue('job-1');
    getDocJobMock.mockResolvedValue({
      jobId: 'job-1',
      state: 'failed',
      progress: 60,
      failedReason: 'AI provider unavailable',
    });

    renderWithQuery(<GenerateDocsButton repoId="repo-1" />);
    fireEvent.click(screen.getByRole('button', { name: /generate documentation/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('AI provider unavailable');
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
