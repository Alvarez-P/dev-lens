import { describe, it, expect } from 'vitest';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_VIEWPORT, clampZoom, zoomBy } from '../viewport';

describe('zoom constraints (REQ-VE-003: 0.1x–4x)', () => {
  it('clamps an over-zoomed level to the max', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM);
  });

  it('clamps an under-zoomed level to the min', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
  });

  it('passes an in-range level through unchanged', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('exposes the spec bounds 0.1 and 4', () => {
    expect(MIN_ZOOM).toBe(0.1);
    expect(MAX_ZOOM).toBe(4);
  });
});

describe('zoomBy — ±10% zoom steps', () => {
  it('increases zoom by the given factor', () => {
    const next = zoomBy({ x: 10, y: 20, zoom: 1 }, 1.1);

    expect(next.zoom).toBeCloseTo(1.1);
    expect(next.x).toBe(10);
    expect(next.y).toBe(20);
  });

  it('clamps the result to the max bound', () => {
    const next = zoomBy({ x: 0, y: 0, zoom: 3.9 }, 1.1);

    expect(next.zoom).toBe(MAX_ZOOM);
  });

  it('clamps the result to the min bound', () => {
    const next = zoomBy({ x: 0, y: 0, zoom: 0.15 }, 0.5);

    expect(next.zoom).toBe(MIN_ZOOM);
  });

  it('produces the default viewport at zoom 1', () => {
    expect(DEFAULT_VIEWPORT).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
