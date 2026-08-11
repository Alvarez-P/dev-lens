'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Square } from 'lucide-react';
import { stream } from '@/lib/api-client';
import { useAIStore } from '@/lib/store/ai-store';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import type { GraphNode } from '@/lib/visualization/types';

export interface AIAnalysisPanelProps {
  /** The selected graph node whose module the AI explains (task 6.3, PR16). */
  node: GraphNode;
}

/**
 * AI streaming panel (ai-streaming R6 scenario, task 6.3).
 *
 * Rendered below the node details in `graph-detail-panel.tsx`. Idle shows an
 * "Analyze with AI" button; clicking it starts `stream('/api/v1/ai/stream',
 * { capability: 'explain-module', repoId, nodeId })` and appends every token
 * chunk to the `useAIStore` as it arrives (typewriter effect). While
 * streaming a Stop button aborts the fetch; a done chunk ends the stream and
 * error chunks surface in a destructive container. When the selected node
 * changes — or the panel unmounts — the in-flight stream is aborted and the
 * store is reset so the next node starts pristine.
 */
export function AIAnalysisPanel({ node }: AIAnalysisPanelProps): React.ReactNode {
  const chunks = useAIStore((state) => state.chunks);
  const status = useAIStore((state) => state.status);
  const errorMessage = useAIStore((state) => state.errorMessage);
  const appendChunk = useAIStore((state) => state.appendChunk);
  const setDone = useAIStore((state) => state.setDone);
  const setError = useAIStore((state) => state.setError);
  const reset = useAIStore((state) => state.reset);

  const abortRef = useRef<(() => void) | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const text = chunks.join('');

  // Abort any in-flight stream and reset the store when the selected node
  // changes (auto-reset) or when the panel unmounts (cleanup).
  useEffect(() => {
    return () => {
      abortRef.current?.();
      abortRef.current = null;
      reset();
    };
  }, [node.id, reset]);

  const handleAnalyze = useCallback(async (): Promise<void> => {
    if (status === 'streaming' || abortRef.current) return;
    reset();
    setIsStarting(true);

    const result = stream('/api/v1/ai/stream', {
      capability: 'explain-module',
      repoId: node.repoId,
      nodeId: node.fqn,
    });
    abortRef.current = result.abort;

    try {
      const reader = result.stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        if (value.type === 'token') {
          appendChunk(value.content);
        } else if (value.type === 'done') {
          setDone();
          break;
        } else if (value.type === 'error') {
          setError(value.content);
          break;
        }
      }
    } finally {
      abortRef.current = null;
      setIsStarting(false);
    }
  }, [status, node.repoId, node.fqn, reset, appendChunk, setDone, setError]);

  const handleStop = useCallback((): void => {
    abortRef.current?.();
    abortRef.current = null;
    reset();
    setIsStarting(false);
  }, [reset]);

  const isStreaming = status === 'streaming' || isStarting;

  return (
    <section aria-label="AI analysis" className="border-t border-white/[0.06] pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-surface-100">AI Analysis</h3>
      </div>

      {status === 'idle' && !isStreaming && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAnalyze}
          leftIcon={<Sparkles className="h-4 w-4" />}
        >
          Analyze with AI
        </Button>
      )}

      {isStreaming && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">
              Streaming
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              aria-label="Stop AI analysis"
              leftIcon={<Square className="h-3.5 w-3.5" />}
            >
              Stop
            </Button>
          </div>

          {text.length > 0 ? (
            <div
              data-testid="ai-analysis-output"
              className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-surface-300"
            >
              {text}
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary-400"
              />
            </div>
          ) : (
            <div aria-label="Generating AI analysis" className="space-y-2">
              <Skeleton width="100%" height="0.75rem" />
              <Skeleton width="85%" height="0.75rem" />
              <Skeleton width="60%" height="0.75rem" />
            </div>
          )}
        </div>
      )}

      {status === 'done' && (
        <div
          data-testid="ai-analysis-output"
          className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-surface-300"
        >
          {text}
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          aria-label="AI analysis error"
          className="rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-300"
        >
          {errorMessage ?? 'AI analysis failed'}
        </div>
      )}
    </section>
  );
}
