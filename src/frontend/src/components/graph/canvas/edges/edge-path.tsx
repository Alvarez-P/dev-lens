'use client';

import type { ReactNode } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { GraphEdge } from '@/lib/visualization/types';
import { dashArray, type EdgeStyle } from './edge-style';

export interface EdgePathProps extends EdgeProps {
  styleConfig: EdgeStyle;
}

/** Make a marker id that is safe inside `url(#...)`. */
function markerIdFor(edgeId: string): string {
  return `viz-arrow-${edgeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/**
 * Shared custom-edge renderer: computes the bezier path from the node
 * positions React Flow provides, then applies the per-edge-type style
 * config (color, dash, arrowhead) to a BaseEdge. The arrowhead marker is
 * rendered as a scoped `<defs>` entry so styling stays inside the edge
 * layer (React Flow's `BaseEdge` only accepts a marker URL string).
 */
export function EdgePath({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  styleConfig,
}: EdgePathProps): ReactNode {
  const edge = (data?.edge ?? {}) as GraphEdge;

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const markerId = markerIdFor(id);
  const markerEnd = styleConfig.arrow ? `url(#${markerId})` : undefined;

  return (
    <g>
      <title>{edge.type}</title>
      {styleConfig.arrow && (
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={styleConfig.color} />
          </marker>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: styleConfig.color,
          strokeWidth: styleConfig.width,
          strokeDasharray: dashArray(styleConfig.dash),
        }}
      />
    </g>
  );
}
