import type { Viewport } from '@/lib/visualization/types';

/**
 * Zoom bounds per REQ-VE-003 (0.1x–4x). Kept framework-free so any adapter
 * and the toolbar share the same constraints.
 */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

/** Default viewport before any user interaction (GN-005). */
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** Clamp a zoom level into the [MIN_ZOOM, MAX_ZOOM] range. */
export function clampZoom(level: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
}

/**
 * Return a new viewport with `zoom` multiplied by `factor` (clamped).
 * Pan coordinates are preserved unchanged.
 */
export function zoomBy(viewport: Viewport, factor: number): Viewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: clampZoom(viewport.zoom * factor),
  };
}
