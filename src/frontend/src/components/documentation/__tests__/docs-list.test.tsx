import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocsList } from '../docs-list';
import { listDocs, generateDocs } from '@/lib/documentation';

vi.mock('@/lib/documentation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/documentation')>();
  return {
    ...actual,
    listDocs: vi.fn(),
    generateDocs: vi.fn(),
    getDocJob: vi.fn(),
  };
});

const listDocsMock = vi.mocked(listDocs);
const generateDocsMock = vi.mocked(generateDocs);

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const readmeArtifact = {
  id: 'doc-1',
  docType: 'readme' as const,
  format: 'markdown' as const,
  sizeBytes: 15360,
  generatedAt: '2026-08-10T12:00:00.000Z',
  templateVersion: '1',
  commitSha: 'abc123',
};

const apiArtifact = {
  id: 'doc-2',
  docType: 'api-reference' as const,
  format: 'openapi' as const,
  sizeBytes: 4096,
  generatedAt: '2026-08-09T12:00:00.000Z',
  templateVersion: '1',
  commitSha: 'abc123',
};

describe('DocsList (7.2)', () => {
  beforeEach(() => {
    listDocsMock.mockReset();
    generateDocsMock.mockReset();
  });

  it('shows a loading skeleton while fetching', () => {
    listDocsMock.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<DocsList repoId="repo-1" />);
    expect(screen.getByLabelText('Loading documentation…')).toBeInTheDocument();
  });

  it('shows the empty state when no docs exist', async () => {
    listDocsMock.mockResolvedValue([]);
    renderWithQuery(<DocsList repoId="repo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/No documentation generated yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /generate documentation/i })).toBeInTheDocument();
  });

  it('renders one card per doc type with the last generated date and format badges', async () => {
    listDocsMock.mockResolvedValue([readmeArtifact, apiArtifact]);
    renderWithQuery(<DocsList repoId="repo-1" />);
    await waitFor(() => {
      expect(screen.getByText('README')).toBeInTheDocument();
    });
    expect(screen.getByText(/Aug 10, 2026/)).toBeInTheDocument();
    expect(screen.getAllByText('Markdown').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('OpenAPI').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Never generated" for doc types with no artifacts', async () => {
    listDocsMock.mockResolvedValue([readmeArtifact]);
    renderWithQuery(<DocsList repoId="repo-1" />);
    await waitFor(() => {
      expect(screen.getByText('Architecture Guide')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Never generated').length).toBeGreaterThanOrEqual(4);
  });

  it('replaces the CTA with a progress indicator after generation starts', async () => {
    listDocsMock.mockResolvedValue([]);
    generateDocsMock.mockResolvedValue('job-1');
    renderWithQuery(<DocsList repoId="repo-1" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate documentation/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /generate documentation/i }));

    await waitFor(() => {
      expect(generateDocsMock).toHaveBeenCalledWith('repo-1', undefined);
    });
    await waitFor(() => {
      expect(screen.getByTestId('generation-progress')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /generate documentation/i }),
    ).not.toBeInTheDocument();
  });

  it('shows an error state when the list fetch fails', async () => {
    listDocsMock.mockRejectedValue(new Error('boom'));
    renderWithQuery(<DocsList repoId="repo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
