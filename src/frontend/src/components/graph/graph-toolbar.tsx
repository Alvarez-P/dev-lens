'use client';

import { clsx } from 'clsx';
import {
  Maximize,
  ZoomIn,
  ZoomOut,
  Network,
  FolderTree,
  GitBranch,
  Braces,
  Layers,
  Globe,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { LayoutType, ViewMode } from '@/lib/visualization/types';
import { VIEWS, applyViewMode } from '@/lib/visualization/views';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { Button } from '@/components/atoms/button';
import { Select } from '@/components/atoms/select';
import { zoomBy } from './canvas/viewport';

const LAYOUT_OPTIONS = [
  { value: LayoutType.FORCE, label: 'Force' },
  { value: LayoutType.HIERARCHICAL, label: 'Hierarchical' },
  { value: LayoutType.RADIAL, label: 'Radial' },
  { value: LayoutType.CIRCULAR, label: 'Circular' },
];

const VIEW_ICONS: Record<ViewMode, LucideIcon> = {
  [ViewMode.OVERVIEW]: Network,
  [ViewMode.MODULES]: FolderTree,
  [ViewMode.DEPENDENCY_TREE]: GitBranch,
  [ViewMode.API_EXPLORER]: Braces,
  [ViewMode.LAYER_ARCHITECTURE]: Layers,
  [ViewMode.DOMAIN_RELATIONSHIPS]: Globe,
  [ViewMode.EVENT_FLOW]: Activity,
};

export interface GraphToolbarProps {
  /** Shared adapter ref (drives fit view); provided by the workspace. */
  adapterRef?: React.RefObject<GraphRendererAdapter | null>;
  className?: string;
}

/**
 * Graph controls: 7 view-mode chips (REQ-VV-001, active chip gets the
 * `primary-500` accent border), a manual layout override, fit view and
 * ±10% zoom buttons (REQ-VE-003).
 */
export function GraphToolbar({ adapterRef, className }: GraphToolbarProps): React.ReactNode {
  const layout = useGraphStore((state) => state.layout);
  const setLayout = useGraphStore((state) => state.setLayout);
  const viewport = useGraphStore((state) => state.viewport);
  const setViewport = useGraphStore((state) => state.setViewport);
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

      <Select
        label="Layout"
        options={LAYOUT_OPTIONS}
        value={layout}
        onChange={(event) => setLayout(event.target.value as LayoutType)}
        className="w-40"
      />

      <Button
        variant="secondary"
        size="sm"
        aria-label="Fit view"
        title="Fit view"
        leftIcon={<Maximize className="h-4 w-4" />}
        onClick={() => adapterRef?.current?.fitView()}
      >
        Fit
      </Button>

      <Button
        variant="secondary"
        size="sm"
        aria-label="Zoom in"
        title="Zoom in"
        leftIcon={<ZoomIn className="h-4 w-4" />}
        onClick={() => setViewport(zoomBy(viewport, 1.1))}
      />

      <Button
        variant="secondary"
        size="sm"
        aria-label="Zoom out"
        title="Zoom out"
        leftIcon={<ZoomOut className="h-4 w-4" />}
        onClick={() => setViewport(zoomBy(viewport, 0.9))}
      />
    </div>
  );
}
