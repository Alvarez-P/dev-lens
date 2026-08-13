'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, RefreshCw } from 'lucide-react';
import { listDocs, groupArtifactsByDocType, ALL_DOC_TYPES } from '@/lib/documentation';
import { LoadingState } from '@/components/molecules/loading-state';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';
import { DocTypeCard } from './doc-type-card';
import { GenerateDocsButton } from './generate-docs-button';

export interface DocsListProps {
  repoId: string;
}

/**
 * Documentation list page view (views R1, R2, R7): fetches all artifacts for
 * the repository, groups them by doc type, renders one card per doc type, and
 * shows an empty state with a "Generate Documentation" CTA when nothing has
 * been generated yet. Owns the generate button + progress polling so cards can
 * disable their download actions while a job is running.
 */
export function DocsList({ repoId }: DocsListProps): React.ReactNode {
  const {
    data: artifacts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['documentation', repoId],
    queryFn: () => listDocs(repoId),
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <LoadingState variant="inline" label="Loading documentation…" />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<BookOpen className="h-12 w-12" />}
        title="Failed to load documentation"
        description="There was a problem fetching the documentation artifacts for this repository."
        action={
          <Button
            variant="outline"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Retry
          </Button>
        }
      />
    );
  }

  const grouped = groupArtifactsByDocType(artifacts);

  if (artifacts.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-12 w-12" />}
        title="No documentation generated yet"
        description="The Documentation Engine analyzes your repository's knowledge graph and produces README, architecture, API reference, module, and onboarding documents — in Markdown, HTML, OpenAPI, Mermaid, PlantUML, and JSON."
        action={<GenerateDocsButton repoId={repoId} prominent />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">
          {artifacts.length} artifact{artifacts.length === 1 ? '' : 's'} across{' '}
          {ALL_DOC_TYPES.length} document types
        </p>
        <GenerateDocsButton repoId={repoId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ALL_DOC_TYPES.map((docType) => (
          <DocTypeCard
            key={docType}
            repoId={repoId}
            docType={docType}
            artifacts={grouped.get(docType) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
