'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { generateDocs, getDocJob, parseProgressStage, type DocType } from '@/lib/documentation';

export interface GenerateDocsButtonProps {
  repoId: string;
  docTypes?: DocType[];
  /** Variant for the empty-state CTA (views R7). */
  prominent?: boolean;
  /** Called once the job reaches a terminal state (completed or failed). */
  onSettled?: () => void;
}

/**
 * "Generate Documentation" button with progress polling (views R5): POSTs to
 * the generate endpoint, polls `GET /docs/jobs/:jobId` until the job reaches a
 * terminal state, and shows the current pipeline stage + percentage. Disabled
 * while a generation is running; the docs list is refetched on completion.
 */
export function GenerateDocsButton({
  repoId,
  docTypes,
  prominent = false,
  onSettled,
}: GenerateDocsButtonProps): React.ReactNode {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failedReason, setFailedReason] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = jobId !== null;

  const startGeneration = useMutation({
    mutationFn: () => generateDocs(repoId, docTypes),
    onSuccess: (id) => {
      setJobId(id);
      setProgress(0);
      setFailedReason(null);
    },
  });

  // Poll the job until it reaches a terminal state (design decision B).
  useEffect(() => {
    if (!jobId) return;

    let active = true;

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const poll = async () => {
      try {
        const job = await getDocJob(repoId, jobId);
        if (!active) return;
        setProgress(job.progress);

        if (job.state === 'completed') {
          stopPolling();
          setJobId(null);
          await queryClient.invalidateQueries({ queryKey: ['documentation', repoId] });
          onSettled?.();
        } else if (job.state === 'failed' || job.failedReason) {
          stopPolling();
          setFailedReason(job.failedReason ?? 'Generation failed');
          setJobId(null);
          onSettled?.();
        }
      } catch {
        // Transient polling error — keep polling; the next tick may recover.
      }
    };

    void poll();
    pollRef.current = setInterval(() => void poll(), 1500);

    return () => {
      active = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, repoId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (running) {
    return (
      <div
        data-testid="generation-progress"
        role="status"
        aria-label="Generation in progress"
        className="w-full max-w-md"
      >
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-primary-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {parseProgressStage(progress)}
          </span>
          <span className="font-mono text-surface-400">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-500"
            style={{ width: `${Math.max(progress, 2)}%` }}
          />
        </div>
      </div>
    );
  }

  if (failedReason) {
    return (
      <div className="flex items-center gap-3">
        <span
          role="alert"
          className="inline-flex items-center gap-1.5 rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-1.5 text-xs text-error-300"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {failedReason}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => startGeneration.mutate()}
          disabled={startGeneration.isPending}
          isLoading={startGeneration.isPending}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={prominent ? 'primary' : 'secondary'}
      onClick={() => startGeneration.mutate()}
      disabled={startGeneration.isPending}
      isLoading={startGeneration.isPending}
      leftIcon={<Sparkles className="h-4 w-4" />}
    >
      Generate Documentation
    </Button>
  );
}
