'use client';

import { useState, type ReactNode, type RefObject } from 'react';
import { clsx } from 'clsx';
import { Search, EyeOff, Ban, SlidersHorizontal } from 'lucide-react';
import { NodeType, EdgeType } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { Input } from '@/components/atoms/input';
import { Select } from '@/components/atoms/select';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { NODE_STYLE } from './canvas/nodes/node-style';
import { countActiveFilters } from './canvas/filter';

const LAYER_OPTIONS = [
  { value: '', label: 'All layers' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'application', label: 'Application' },
  { value: 'domain', label: 'Domain' },
  { value: 'infrastructure', label: 'Infrastructure' },
];

export interface GraphFilterBarProps {
  /** Ref to the search input so keyboard shortcuts (Ctrl+F) can focus it. */
  searchInputRef?: RefObject<HTMLInputElement | null>;
  /** Fired on Enter in the search input (auto-centers the first match). */
  onSearchSubmit?: () => void;
  className?: string;
}

/**
 * Filter bar below the toolbar (VV-002): one toggle chip per node type with
 * All/None quick buttons, per-edge-type toggles, a derived-layer filter,
 * Hide External Deps / Hide Deprecated switches, the active-filter-count
 * badge and a Reset Filters link. Reads/writes the Zustand filterSlice.
 */
export function GraphFilterBar({
  searchInputRef,
  onSearchSubmit,
  className,
}: GraphFilterBarProps): React.ReactNode {
  const visibleNodeTypes = useGraphStore((state) => state.visibleNodeTypes);
  const visibleEdgeTypes = useGraphStore((state) => state.visibleEdgeTypes);
  const showExternal = useGraphStore((state) => state.showExternal);
  const showDeprecated = useGraphStore((state) => state.showDeprecated);
  const layerFilter = useGraphStore((state) => state.layerFilter);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const toggleNodeType = useGraphStore((state) => state.toggleNodeType);
  const toggleEdgeType = useGraphStore((state) => state.toggleEdgeType);
  const setVisibleNodeTypes = useGraphStore((state) => state.setVisibleNodeTypes);
  const setShowExternal = useGraphStore((state) => state.setShowExternal);
  const setShowDeprecated = useGraphStore((state) => state.setShowDeprecated);
  const setLayerFilter = useGraphStore((state) => state.setLayerFilter);
  const setSearchQuery = useGraphStore((state) => state.setSearchQuery);
  const resetFilters = useGraphStore((state) => state.resetFilters);

  const [collapsed, setCollapsed] = useState(true);

  const activeCount = countActiveFilters({
    visibleNodeTypes,
    visibleEdgeTypes,
    showExternal,
    showDeprecated,
    layerFilter,
    searchQuery,
  });

  const typeChip = (type: NodeType): ReactNode => {
    const active = visibleNodeTypes.includes(type);
    const style = NODE_STYLE[type];
    const Icon = style.icon;

    return (
      <button
        key={type}
        type="button"
        aria-label={`Toggle ${type}`}
        aria-pressed={active}
        onClick={() => toggleNodeType(type)}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          active
            ? 'border-primary-500/40 bg-primary-500/10 text-primary-200 hover:bg-primary-500/15'
            : 'border-white/[0.06] bg-white/[0.02] text-surface-400 hover:border-white/[0.12] hover:text-surface-200',
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: style.accent }} aria-hidden="true" />
        {type}
      </button>
    );
  };

  const edgeToggle = (edge: EdgeType): ReactNode => {
    const active = visibleEdgeTypes.includes(edge);

    return (
      <button
        key={edge}
        type="button"
        aria-label={`Toggle edge ${edge}`}
        aria-pressed={active}
        onClick={() => toggleEdgeType(edge)}
        className={clsx(
          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          active
            ? 'border-white/[0.14] bg-white/[0.08] text-surface-100'
            : 'border-white/[0.06] bg-white/[0.02] text-surface-500 hover:text-surface-300',
        )}
      >
        {edge}
      </button>
    );
  };

  const hideToggle = (label: string, icon: ReactNode, active: boolean, onToggle: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary-500/40 bg-primary-500/10 text-primary-200'
          : 'border-white/[0.06] bg-white/[0.02] text-surface-400 hover:border-white/[0.12] hover:text-surface-200',
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <section
      aria-label="Graph filters"
      className={clsx(
        'flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-surface-900/60 p-3 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          label="Search nodes"
          ref={searchInputRef}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSearchSubmit?.();
            }
          }}
          placeholder="Search by name or FQN…"
          leftIcon={<Search className="h-4 w-4" />}
          className="w-64"
        />

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && <Badge variant="info">{activeCount} filters active</Badge>}

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
            title={collapsed ? 'Expand filters' : 'Collapse filters'}
            onClick={() => setCollapsed((value) => !value)}
            leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          >
            {collapsed ? 'Filters' : 'Hide'}
          </Button>
        </div>
      </div>

      <div className={clsx('space-y-3', collapsed && 'hidden')}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 text-xs font-medium uppercase tracking-wide text-surface-500">
            Types
          </span>

          <button
            type="button"
            aria-label="All"
            onClick={() => setVisibleNodeTypes(Object.values(NodeType))}
            className="rounded-full px-2 py-1 text-xs font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            All
          </button>
          <button
            type="button"
            aria-label="None"
            onClick={() => setVisibleNodeTypes([])}
            className="rounded-full px-2 py-1 text-xs font-medium text-surface-500 transition-colors hover:text-surface-300"
          >
            None
          </button>

          <span className="mx-1 hidden h-4 w-px bg-white/[0.08] sm:block" aria-hidden="true" />

          {Object.values(NodeType).map(typeChip)}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 text-xs font-medium uppercase tracking-wide text-surface-500">
            Edges
          </span>
          {Object.values(EdgeType).map(edgeToggle)}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Layer"
            options={LAYER_OPTIONS}
            value={layerFilter ?? ''}
            onChange={(event) => setLayerFilter(event.target.value || null)}
            className="w-44"
          />

          {hideToggle(
            'Hide external deps',
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />,
            !showExternal,
            () => setShowExternal(!showExternal),
          )}
          {hideToggle(
            'Hide deprecated',
            <Ban className="h-3.5 w-3.5" aria-hidden="true" />,
            !showDeprecated,
            () => setShowDeprecated(!showDeprecated),
          )}
        </div>
      </div>
    </section>
  );
}
