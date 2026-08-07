import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { NodeType, EdgeType, ViewMode } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import { VIEWS } from '@/lib/visualization/views';

import { GraphToolbar } from '../graph-toolbar';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
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

describe('GraphToolbar — view switcher (VV-001)', () => {
  it('renders a chip per view mode', () => {
    render(<GraphToolbar />);

    for (const view of VIEWS) {
      expect(screen.getByRole('button', { name: view.label })).toBeInTheDocument();
    }
  });

  it('switching a view updates the store view and filters', () => {
    render(<GraphToolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Module Dependencies' }));

    const state = useGraphStore.getState();
    expect(state.viewMode).toBe(ViewMode.MODULES);
    expect(state.visibleNodeTypes).toEqual([NodeType.MODULE]);
    expect(state.visibleEdgeTypes).toEqual([EdgeType.DEPENDS_ON]);
  });

  it('marks the active view chip with aria-pressed', () => {
    act(() => {
      useGraphStore.getState().setViewMode(ViewMode.API_EXPLORER);
    });
    render(<GraphToolbar />);

    expect(screen.getByRole('button', { name: 'API Explorer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
