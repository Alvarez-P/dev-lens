'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { GraphEdge } from '@/lib/visualization/types';
import { dashArray, type EdgeStyle } from './edge-style';

export interface EdgePathProps extends EdgeProps {
  styleConfig: EdgeStyle;
  /**
   * When this value changes, a token circle travels along the edge path
   * (REQ-VV-007). The token is created and moved via direct DOM mutation on
   * the `<g>` — never through React state — so the edge never re-renders per
   * frame. Pass null/undefined to remove any traveling token. Falls back to
   * `data.edge.properties.animationToken` when the prop is omitted, so the
   * flow controller can annotate the active step edge without touching every
   * edge component.
   */
  animationToken?: string | null;
}

/** One token travel duration in ms (the flow controller advances steps after this). */
export const TOKEN_TRAVEL_DURATION_MS = 800;

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
 * Resolve the point at `progress` (0..1) along an SVG path using the browser
 * geometry APIs. Returns null when the APIs are unavailable (jsdom/SSR) so the
 * animation loop stops instead of guessing a position.
 */
function pointAtLength(path: SVGElement, progress: number): { x: number; y: number } | null {
  if (typeof path.getPointAtLength !== 'function') {
    return null;
  }
  const total = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 1;
  const point = path.getPointAtLength(Math.min(Math.max(progress, 0), 1) * total);
  return { x: point.x, y: point.y };
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
  animationToken,
}: EdgePathProps): ReactNode {
  const edge = (data?.edge ?? {}) as GraphEdge;
  const [hovered, setHovered] = useState(false);

  // Data-driven token: the flow controller annotates the active step edge
  // with `properties.animationToken`; the explicit prop takes precedence.
  const dataToken =
    typeof edge.properties?.animationToken === 'string' ? edge.properties.animationToken : null;
  const token = animationToken ?? dataToken;

  const groupRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number | null>(null);
  const circleRef = useRef<SVGCircleElement | null>(null);
  const startTimeRef = useRef(0);
  const activeTokenRef = useRef<string | null>(null);

  /** Cancel the loop and remove the traveling token from the `<g>`. */
  const clearToken = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (circleRef.current !== null) {
      circleRef.current.remove();
      circleRef.current = null;
    }
  }, []);

  /** Start (or restart) a full token travel along the path. */
  const startToken = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    const pathEl = group.querySelector('path');
    // Culling (REQ-VV-004): never animate an edge whose path is not mounted.
    if (!pathEl || !pathEl.isConnected) return;

    if (circleRef.current === null) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('data-testid', `token-circle-${id}`);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', styleConfig.color);
      group.appendChild(circle);
      circleRef.current = circle;
    }

    startTimeRef.current = performance.now();

    const tick = (now: number): void => {
      const g = groupRef.current;
      const p = g ? g.querySelector('path') : null;
      // Culled mid-travel (edge unmounted/hidden) → stop the loop.
      if (!g || !g.isConnected || !p) return;

      const progress = Math.min((now - startTimeRef.current) / TOKEN_TRAVEL_DURATION_MS, 1);
      const point = pointAtLength(p, progress);
      if (!point) return; // no SVG geometry → cannot travel further.

      if (circleRef.current) {
        circleRef.current.setAttribute('cx', String(point.x));
        circleRef.current.setAttribute('cy', String(point.y));
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [id, styleConfig.color]);

  // Drive the animation from the token: restart on change, keep running on
  // re-render with the same token, clear on null.
  useEffect(() => {
    if (token === null || token === undefined) {
      clearToken();
      activeTokenRef.current = null;
      return;
    }
    if (token === activeTokenRef.current) {
      return; // in-flight travel keeps running (no restart)
    }
    activeTokenRef.current = token;
    clearToken();
    startToken();
    return () => clearToken();
  }, [token, clearToken, startToken]);

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
      ref={groupRef}
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
