'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { LoadingState } from '@/components/molecules/loading-state';
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
import { MarkdownViewer } from '@/components/documentation/markdown-viewer';
import {
  DOC_TYPE_LABELS,
  DOC_FORMAT_LABELS,
  downloadFilenameFor,
  fetchDocText,
  downloadDocArtifact,
  type DocType,
  type DocFormat,
} from '@/lib/documentation';

interface DocMetadata {
  id: string;
  repositoryId: string;
  commitSha: string;
  docType: DocType;
  format: DocFormat;
  sizeBytes: number;
  generatedAt: string;
  templateVersion: string;
  aiModelVersion: string | null;
  status: string;
  downloadUrl: string;
}

/**
 * Documentation artifact viewer route (views R3) —
 * `/repositories/[id]/docs/[artifact]`. Fetches the artifact metadata, streams
 * the raw Markdown from the download endpoint, and renders it client-side with
 * GFM tables, syntax highlighting, Mermaid diagrams, and AI badges. Non-markdown
 * artifacts show a download-only panel.
 */
export default function DocumentationViewerPage(): React.ReactNode {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const docId = params.artifact as string;

  const {
    data: metadata,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['documentation-artifact', id, docId],
    queryFn: async () => {
      const response = await get<DocMetadata>(`/api/v1/repositories/${id}/docs/${docId}`);
      if (isSuccessResponse(response) && response.data) {
        return response.data as DocMetadata;
      }
      throw new Error('Artifact not found');
    },
    staleTime: 60_000,
  });

  const { data: markdown, isLoading: markdownLoading } = useQuery({
    queryKey: ['documentation-content', id, docId],
    queryFn: () => fetchDocText(id, docId),
    enabled: metadata?.format === 'markdown',
    staleTime: 60_000,
  });

  const back = () => router.push(`/repositories/${id}/docs`);

  if (isLoading || (metadata?.format === 'markdown' && markdownLoading)) {
    return <LoadingState variant="page" label="Loading documentation…" />;
  }

  if (error || !metadata) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Documentation not found"
          description="The artifact you're looking for doesn't exist."
          actions={
            <Button variant="outline" onClick={back}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to documentation
            </Button>
          }
        />
      </div>
    );
  }

  const title = `${DOC_TYPE_LABELS[metadata.docType]} — ${DOC_FORMAT_LABELS[metadata.format]}`;

  const handleDownload = async (): Promise<void> => {
    try {
      await downloadDocArtifact(
        id,
        metadata.id,
        downloadFilenameFor(metadata.docType, metadata.format),
      );
    } catch {
      // Surface via the page-level error boundary / toast in a future iteration.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`${metadata.commitSha.slice(0, 7)} · ${new Date(
          metadata.generatedAt,
        ).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} · ${(metadata.sizeBytes / 1024).toFixed(1)} KB · v${metadata.templateVersion}`}
        actions={
          <div className="flex items-center gap-2">
            {metadata.aiModelVersion && <Badge variant="info">AI-enriched</Badge>}
            <Button
              variant="outline"
              onClick={() => void handleDownload()}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download
            </Button>
            <Button variant="outline" onClick={back}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      {metadata.format === 'markdown' && markdown !== undefined ? (
        <div className="rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6">
          <MarkdownViewer markdown={markdown} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.04] bg-surface-900/60 py-16 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-surface-600" />
          <p className="text-sm text-surface-400">
            This artifact is a {DOC_FORMAT_LABELS[metadata.format]} document — use the download
            button to open it.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => void handleDownload()}>
            <Download className="mr-2 h-4 w-4" />
            Download {DOC_FORMAT_LABELS[metadata.format]}
          </Button>
        </div>
      )}
    </div>
  );
}
