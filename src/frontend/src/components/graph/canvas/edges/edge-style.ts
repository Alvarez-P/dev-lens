import { EdgeType } from '@/lib/visualization/types';

/** Dash style mapping per design (VE-001 edge table). */
export type EdgeDash = 'solid' | 'dashed' | 'dotted';

export interface EdgeStyle {
  /** Design accent hex for the stroke. */
  color: string;
  dash: EdgeDash;
  arrow: boolean;
  /** Stroke width in px (BELONGS_TO/IMPORTS are thin). */
  width: number;
}

/** SVG stroke-dasharray for each dash style (solid → none). */
export function dashArray(dash: EdgeDash): string | undefined {
  switch (dash) {
    case 'dashed':
      return '6 4';
    case 'dotted':
      return '2 2';
    default:
      return undefined;
  }
}

export const EDGE_STYLE: Record<EdgeType, EdgeStyle> = {
  [EdgeType.BELONGS_TO]: { color: '#505054', dash: 'solid', arrow: false, width: 1 }, // surface-500, thin, no arrow
  [EdgeType.DEPENDS_ON]: { color: '#a1a1a4', dash: 'solid', arrow: true, width: 1.5 }, // surface-300
  [EdgeType.IMPLEMENTS]: { color: '#47e02e', dash: 'dashed', arrow: true, width: 1.5 }, // success-400
  [EdgeType.EXTENDS]: { color: '#d6ff2e', dash: 'solid', arrow: true, width: 1.5 }, // primary-400
  [EdgeType.EXPOSES]: { color: '#fbbf24', dash: 'dotted', arrow: true, width: 1.5 }, // warning-400
  [EdgeType.IMPORTS]: { color: '#505054', dash: 'dashed', arrow: false, width: 1 }, // surface-500, no arrow
};
