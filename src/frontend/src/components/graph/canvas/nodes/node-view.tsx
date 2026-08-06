'use client';

import type { ReactNode } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Badge } from '@/components/atoms/badge';
import type { GraphNode } from '@/lib/visualization/types';
import type { NodeShape, NodeStyle } from './node-style';

/**
 * Border treatments per shape. Deliberate v1 tradeoff: geometric shapes
 * (diamond/hexagon/pentagon/chevron) are expressed as a small accent glyph
 * plus a border treatment instead of clipping the whole node — clip-path on
 * the container would crop the label text.
 */
const SHAPE_RADIUS: Record<NodeShape, string> = {
  diamond: 'rounded-md',
  'diamond-dashed': 'rounded-md border-dashed',
  'rounded-rect': 'rounded-lg',
  folder: 'rounded-t-xl rounded-b-md',
  hexagon: 'rounded-md',
  rectangle: 'rounded-sm',
  cylinder: 'rounded-full',
  pentagon: 'rounded-md',
  circle: 'rounded-full',
  chevron: 'rounded-md',
  cloud: 'rounded-2xl',
};

/** Small geometric glyph (kept off the text, so labels stay readable). */
const SHAPE_GLYPH: Partial<Record<NodeShape, string>> = {
  diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  'diamond-dashed': 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  hexagon: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)',
  pentagon: 'polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)',
  chevron: 'polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%, 25% 50%)',
};

export interface NodeViewProps extends NodeProps {
  style: NodeStyle;
}

/**
 * Presentational node chip shared by all 12 custom node components:
 * shape glyph + icon + label + type badge + deprecated indicator.
 *
 * REQ-VI-003: On hover a tooltip shows type icon, label, and FQN.
 */
export function NodeView({ data, selected, style }: NodeViewProps): ReactNode {
  const node = data.node as GraphNode;
  const Icon = style.icon;
  const glyph = SHAPE_GLYPH[style.shape];

  return (
    <div className="group relative">
      {/* Tooltip — REQ-VI-003 */}
      <div
        data-testid="node-tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border border-white/[0.08] bg-surface-800/95 px-2.5 py-1.5 text-xs shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Icon aria-hidden="true" className="h-3 w-3 shrink-0" style={{ color: style.accent }} />
          <span className="font-medium text-surface-100">{node.label}</span>
          <span className="text-[10px] text-surface-400">{node.type}</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-surface-500">{node.fqn}</div>
      </div>

      <div
        data-testid="node"
        data-node-type={node.type}
        data-accent={style.accent}
        data-selected={selected ? 'true' : undefined}
        className={`flex max-w-[220px] items-center gap-1.5 border px-2.5 py-1.5 text-xs ${SHAPE_RADIUS[style.shape]}`}
        style={{ borderColor: style.accent }}
      >
        {glyph && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0"
            style={{ backgroundColor: style.accent, clipPath: glyph }}
          />
        )}
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" style={{ color: style.accent }} />
        <span data-testid="node-label" className="truncate font-medium text-surface-100">
          {node.label}
        </span>
        <Badge variant={style.badgeVariant} size="sm" data-testid="node-type-badge">
          {node.type}
        </Badge>
        {node.deprecatedAt && (
          <span
            data-testid="node-deprecated"
            className="text-[10px] uppercase tracking-wide text-error-400"
          >
            deprecated
          </span>
        )}
      </div>
    </div>
  );
}
