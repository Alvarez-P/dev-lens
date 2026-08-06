'use client';

import { type ReactNode, useState } from 'react';
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

/** Compute the midpoint of a cubic bezier for label placement. */
function bezierMidpoint(sx: number, sy: number, tx: number, ty: number): { x: number; y: number } {
  // Bezier control points are auto-computed by getBezierPath.
  // Approximate midpoint at 50% along the straight-line distance.
  return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
}

/**
 * Shared custom-edge renderer: computes the bezier path from the node
 * positions React Flow provides, then applies the per-edge-type style
 * config (color, dash, arrowhead) to a BaseEdge.
 *
 * REQ-VI-002: On hover the edge thickens and shows a type label badge.
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
  const [hovered, setHovered] = useState(false);

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

  const strokeWidth = hovered ? styleConfig.width * 2.5 : styleConfig.width;
  const mid = bezierMidpoint(sourceX, sourceY, targetX, targetY);

  return (
    <g
      data-testid={`edge-group-${id}`}
      data-hovered={hovered || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
          strokeWidth,
          strokeDasharray: dashArray(styleConfig.dash),
          transition: 'stroke-width 120ms ease-out',
        }}
      />
      {hovered && (
        <g data-testid={`edge-label-${id}`}>
          <rect
            x={mid.x - 32}
            y={mid.y - 10}
            width={64}
            height={18}
            rx={4}
            fill="#18181b"
            stroke={styleConfig.color}
            strokeWidth={1}
            opacity={0.95}
          />
          <text
            x={mid.x}
            y={mid.y + 3}
            textAnchor="middle"
            fill={styleConfig.color}
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
          >
            {edge.type}
          </text>
        </g>
      )}
    </g>
  );
}
