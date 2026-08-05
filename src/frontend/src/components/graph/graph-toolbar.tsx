'use client';

import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { LayoutType, ViewMode } from '@/lib/visualization/types';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Select } from '@/components/atoms/select';
import { zoomBy } from './canvas/viewport';

const LAYOUT_OPTIONS = [
  { value: LayoutType.FORCE, label: 'Force' },
  { value: LayoutType.HIERARCHICAL, label: 'Hierarchical' },
  { value: LayoutType.RADIAL, label: 'Radial' },
  { value: LayoutType.CIRCULAR, label: 'Circular' },
];

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  [ViewMode.OVERVIEW]: 'Overview',
  [ViewMode.MODULES]: 'Module Dependencies',
  [ViewMode.DEPENDENCY_TREE]: 'Dependency Tree',
  [ViewMode.API_EXPLORER]: 'API Explorer',
  [ViewMode.LAYER_ARCHITECTURE]: 'Layer Architecture',
  [ViewMode.DOMAIN_RELATIONSHIPS]: 'Domain Relationships',
  [ViewMode.EVENT_FLOW]: 'Event Flow',
};

export interface GraphToolbarProps {
  /** Shared adapter ref (drives fit view); provided by the workspace in C4. */
  adapterRef?: React.RefObject<GraphRendererAdapter | null>;
  className?: string;
}

/**
 * Graph controls: layout switcher, fit view, ±10% zoom (REQ-VE-003). The
 * view-mode chip is a placeholder — full view switching lands in C5.
 */
export function GraphToolbar({ adapterRef, className }: GraphToolbarProps): React.ReactNode {
  const layout = useGraphStore((state) => state.layout);
  const setLayout = useGraphStore((state) => state.setLayout);
  const viewport = useGraphStore((state) => state.viewport);
  const setViewport = useGraphStore((state) => state.setViewport);
  const viewMode = useGraphStore((state) => state.viewMode);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      <Badge variant="info" title="View switching arrives with the C5 view presets">
        {VIEW_MODE_LABELS[viewMode]}
      </Badge>

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
