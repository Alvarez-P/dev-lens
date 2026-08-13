'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { FileText, BookOpen, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import {
  type DocType,
  type DocFormat,
  type DocArtifactSummary,
  ALL_DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_FORMAT_LABELS,
  downloadFilenameFor,
  formatGeneratedDate,
} from '@/lib/documentation';

const DOC_TYPE_ICONS: Record<DocType, React.ReactNode> = {
  readme: <FileText className="h-5 w-5" />,
  'architecture-guide': <BookOpen className="h-5 w-5" />,
  'api-reference': <BookOpen className="h-5 w-5" />,
  'module-docs': <BookOpen className="h-5 w-5" />,
  'onboarding-guide': <BookOpen className="h-5 w-5" />,
};

export interface DocTypeCardProps {
  repoId: string;
  docType: DocType;
  /** Artifacts for this doc type, newest first. */
  artifacts: DocArtifactSummary[];
  /** Disables download buttons while a generation job is running (views R4). */
  generating?: boolean;
  onDownload?: (artifact: DocArtifactSummary) => void;
}

/**
 * One card per doc type (views R2): human-readable title, the last generated
 * date (or "Never generated"), a badge per available format, and a download
 * button per format (views R4). Markdown artifacts link to the inline viewer.
 */
export function DocTypeCard({
  repoId,
  docType,
  artifacts,
  generating = false,
  onDownload,
}: DocTypeCardProps): React.ReactNode {
  const [downloading, setDownloading] = useState(false);

  const latest = artifacts[0];
  const lastGenerated = latest ? formatGeneratedDate(latest.generatedAt) : 'Never generated';

  // One badge + download per available format (newest artifact of that format).
  const formats = new Map<DocFormat, DocArtifactSummary>();
  for (const artifact of artifacts) {
    if (!formats.has(artifact.format)) {
      formats.set(artifact.format, artifact);
    }
  }

  const markdownArtifact = formats.get('markdown');

  const handleDownload = async (artifact: DocArtifactSummary): Promise<void> => {
    if (onDownload) {
      onDownload(artifact);
      return;
    }
    setDownloading(true);
    try {
      const { downloadDocArtifact } = await import('@/lib/documentation');
      await downloadDocArtifact(
        repoId,
        artifact.id,
        downloadFilenameFor(artifact.docType, artifact.format),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      data-testid={`doc-card-${docType}`}
      className="flex flex-col rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-5 transition-colors hover:border-primary-500/20"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
          {DOC_TYPE_ICONS[docType]}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-surface-100">{DOC_TYPE_LABELS[docType]}</h3>
          <p className="text-xs text-surface-500">
            {lastGenerated}
            {latest && (
              <span className="ml-2 font-mono text-[10px] text-surface-600">
                {latest.commitSha.slice(0, 7)}
              </span>
            )}
          </p>
        </div>
      </div>

      {formats.size === 0 ? (
        <p className="mt-4 text-xs text-surface-600">
          No artifacts generated yet. Click &quot;Generate Documentation&quot; to create this
          document.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[...formats.entries()].map(([format]) => (
            <Badge key={format} variant="default">
              {DOC_FORMAT_LABELS[format]}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {markdownArtifact && (
          <Link
            href={`/repositories/${repoId}/docs/${markdownArtifact.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:bg-white/[0.04]"
          >
            View
          </Link>
        )}
        {[...formats.entries()].map(([format, artifact]) => (
          <Button
            key={`dl-${format}`}
            variant="outline"
            size="sm"
            disabled={generating || downloading}
            isLoading={downloading}
            title={generating ? 'Generation in progress' : undefined}
            aria-label={`Download ${DOC_FORMAT_LABELS[format]}`}
            onClick={() => handleDownload(artifact)}
          >
            <Download className="h-3.5 w-3.5" />
            {DOC_FORMAT_LABELS[format]}
          </Button>
        ))}
      </div>

      {generating && (
        <span
          className={clsx('mt-2 inline-flex items-center gap-1.5 text-[11px] text-primary-300')}
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Generation in progress
        </span>
      )}
    </div>
  );
}

/** Card order follows the canonical doc type list (views R2). */
export const DOC_CARD_ORDER: DocType[] = ALL_DOC_TYPES;
