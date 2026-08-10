'use client';

import { clsx } from 'clsx';
import {
  Network,
  FolderTree,
  GitBranch,
  Braces,
  Layers,
  Globe,
  Activity,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { ViewMode } from '@/lib/visualization/types';
import { VIEWS, applyViewMode } from '@/lib/visualization/views';

const VIEW_ICONS: Record<ViewMode, LucideIcon> = {
  [ViewMode.OVERVIEW]: Network,
  [ViewMode.MODULES]: FolderTree,
  [ViewMode.DEPENDENCY_TREE]: GitBranch,
  [ViewMode.API_EXPLORER]: Braces,
  [ViewMode.LAYER_ARCHITECTURE]: Layers,
  [ViewMode.DOMAIN_RELATIONSHIPS]: Globe,
  [ViewMode.EVENT_FLOW]: Activity,
  [ViewMode.REQUEST_FLOW]: Waypoints,
};

export interface GraphToolbarProps {
  className?: string;
}

/**
 * Graph controls: 8 view-mode chips (REQ-VV-001, active chip gets the
 * `primary-500` accent border; REQUEST_FLOW is the 8th option).
 */
export function GraphToolbar({ className }: GraphToolbarProps): React.ReactNode {
  const viewMode = useGraphStore((state) => state.viewMode);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      <div
        role="group"
        aria-label="View modes"
        className="flex flex-wrap items-center gap-1 rounded-lg bg-white/[0.03] p-1 backdrop-blur-md"
      >
        {VIEWS.map((view) => {
          const Icon = VIEW_ICONS[view.mode];
          const active = view.mode === viewMode;

          return (
            <button
              key={view.mode}
              type="button"
              aria-pressed={active}
              title={view.description}
              onClick={() => applyViewMode(view.mode)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary-500 bg-primary-500/10 text-primary-200'
                  : 'border-transparent text-surface-300 hover:bg-white/[0.04] hover:text-surface-100',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {view.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
