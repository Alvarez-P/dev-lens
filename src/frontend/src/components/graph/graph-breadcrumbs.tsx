'use client';

import { clsx } from 'clsx';
import { Home } from 'lucide-react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';

export interface GraphBreadcrumbsProps {
  /**
   * Fired after the trail is truncated to the clicked segment, with the
   * segment index — lets the caller re-center the viewport on that level
   * (GN-003 back-navigation).
   */
  onNavigateTo?: (index: number) => void;
  className?: string;
}

/**
 * BELONGS_TO breadcrumb trail rendered above the graph viewport (REQ-GN-003)
 * in a `.glass-subtle` pill (`bg-white/[0.03] backdrop-blur-md`). Every
 * segment except the current one is a button that truncates the trail back to
 * that level; the current segment is non-clickable and highlighted.
 */
export function GraphBreadcrumbs({
  onNavigateTo,
  className,
}: GraphBreadcrumbsProps): React.ReactNode {
  const breadcrumbs = useGraphStore((state) => state.breadcrumbs);
  const truncateBreadcrumbs = useGraphStore((state) => state.truncateBreadcrumbs);

  const navigateTo = (index: number): void => {
    truncateBreadcrumbs(index);
    onNavigateTo?.(index);
  };

  return (
    <nav
      aria-label="Breadcrumbs"
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm backdrop-blur-md',
        className,
      )}
    >
      <Home className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />

      {breadcrumbs.length === 0 ? (
        <span className="font-medium text-surface-200">Graph</span>
      ) : (
        breadcrumbs.map((segment, index) => {
          const isCurrent = index === breadcrumbs.length - 1;

          return (
            <span key={`${segment}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-surface-500" aria-hidden="true">
                  &gt;
                </span>
              )}

              {isCurrent ? (
                <span aria-current="page" className="font-medium text-surface-100">
                  {segment}
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Back to ${segment}`}
                  onClick={() => navigateTo(index)}
                  className="rounded text-surface-400 transition-colors hover:text-primary-400 focus-ring"
                >
                  {segment}
                </button>
              )}
            </span>
          );
        })
      )}
    </nav>
  );
}
