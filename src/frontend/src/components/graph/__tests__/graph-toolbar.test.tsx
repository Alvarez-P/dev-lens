import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { LayoutType, ViewMode } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';

import { GraphToolbar } from '../graph-toolbar';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

describe('GraphToolbar — layout switcher', () => {
  it('switches the layout through the store', () => {
    render(<GraphToolbar />);

    fireEvent.change(screen.getByLabelText(/layout/i), {
      target: { value: LayoutType.HIERARCHICAL },
    });

    expect(useGraphStore.getState().layout).toBe(LayoutType.HIERARCHICAL);
  });

  it('offers every supported layout option', () => {
    render(<GraphToolbar />);

    const select = screen.getByLabelText(/layout/i) as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.value)).toEqual(
      expect.arrayContaining(['force', 'hierarchical', 'radial', 'circular']),
    );
  });
});

describe('GraphToolbar — fit view', () => {
  it('calls adapter.fitView from the fit button', () => {
    const fitView = vi.fn();
    const adapterRef = { current: { fitView } as unknown as GraphRendererAdapter };

    render(<GraphToolbar adapterRef={adapterRef} />);

    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));

    expect(fitView).toHaveBeenCalledOnce();
  });
});

describe('GraphToolbar — zoom controls', () => {
  it('zooms in by 10% through the store viewport', () => {
    useGraphStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
    render(<GraphToolbar />);

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    expect(useGraphStore.getState().viewport.zoom).toBeCloseTo(1.1);
  });

  it('zooms out by 10% through the store viewport', () => {
    useGraphStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
    render(<GraphToolbar />);

    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));

    expect(useGraphStore.getState().viewport.zoom).toBeCloseTo(0.9);
  });

  it('clamps zoom in at the max bound', () => {
    useGraphStore.getState().setViewport({ x: 0, y: 0, zoom: 3.9 });
    render(<GraphToolbar />);

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    expect(useGraphStore.getState().viewport.zoom).toBe(4);
  });

  it('clamps zoom out at the min bound', () => {
    useGraphStore.getState().setViewport({ x: 0, y: 0, zoom: 0.1 });
    render(<GraphToolbar />);

    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));

    // 0.1 * 0.9 = 0.09 → clamped back to the floor.
    expect(useGraphStore.getState().viewport.zoom).toBe(0.1);
  });
});

describe('GraphToolbar — view mode label placeholder', () => {
  it('shows the current view mode', () => {
    act(() => {
      useGraphStore.getState().setViewMode(ViewMode.API_EXPLORER);
    });
    render(<GraphToolbar />);

    expect(screen.getByText(/API Explorer/i)).toBeInTheDocument();
  });
});
