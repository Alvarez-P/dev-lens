import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocTypeCard } from '../doc-type-card';
import { downloadDocArtifact } from '@/lib/documentation';

vi.mock('@/lib/documentation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/documentation')>();
  return {
    ...actual,
    downloadDocArtifact: vi.fn(),
  };
});

const downloadDocArtifactMock = vi.mocked(downloadDocArtifact);

const readmeArtifact = {
  id: 'doc-1',
  docType: 'readme' as const,
  format: 'markdown' as const,
  sizeBytes: 15360,
  generatedAt: '2026-08-10T12:00:00.000Z',
  templateVersion: '1',
  commitSha: 'abc123',
};

describe('DocTypeCard (7.2 / 7.4)', () => {
  beforeEach(() => {
    downloadDocArtifactMock.mockReset();
    downloadDocArtifactMock.mockResolvedValue(undefined);
  });

  it('shows the human-readable title and last generated date', () => {
    render(<DocTypeCard repoId="repo-1" docType="readme" artifacts={[readmeArtifact]} />);
    expect(screen.getByText('README')).toBeInTheDocument();
    expect(screen.getByText(/Aug 10, 2026/)).toBeInTheDocument();
  });

  it('shows "Never generated" and no format badges when no artifacts exist', () => {
    render(<DocTypeCard repoId="repo-1" docType="api-reference" artifacts={[]} />);
    expect(screen.getByText('API Reference')).toBeInTheDocument();
    expect(screen.getByText('Never generated')).toBeInTheDocument();
    expect(screen.queryByText('Markdown')).not.toBeInTheDocument();
  });

  it('renders a download button per available format (R4)', () => {
    render(
      <DocTypeCard
        repoId="repo-1"
        docType="readme"
        artifacts={[readmeArtifact, { ...readmeArtifact, id: 'doc-html', format: 'html' as const }]}
      />,
    );
    expect(screen.getByRole('button', { name: /download markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download html/i })).toBeInTheDocument();
  });

  it('disables download buttons with a "Generation in progress" tooltip while generating (R4)', () => {
    render(
      <DocTypeCard repoId="repo-1" docType="readme" artifacts={[readmeArtifact]} generating />,
    );
    const button = screen.getByRole('button', { name: /download markdown/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Generation in progress');
    expect(screen.getByText(/generation in progress/i)).toBeInTheDocument();
  });

  it('links markdown artifacts to the inline viewer (R3)', () => {
    render(<DocTypeCard repoId="repo-1" docType="readme" artifacts={[readmeArtifact]} />);
    const viewLink = screen.getByRole('link', { name: /view/i });
    expect(viewLink).toHaveAttribute('href', '/repositories/repo-1/docs/doc-1');
  });

  it('calls downloadDocArtifact with the backend filename when a download is clicked', async () => {
    render(<DocTypeCard repoId="repo-1" docType="readme" artifacts={[readmeArtifact]} />);
    fireEvent.click(screen.getByRole('button', { name: /download markdown/i }));

    await waitFor(() => {
      expect(downloadDocArtifactMock).toHaveBeenCalledWith('repo-1', 'doc-1', 'readme.md');
    });
  });
});
