import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { NodeType, EdgeType } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';

import { GraphFilterBar } from '../graph-filter-bar';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

describe('GraphFilterBar — type chips', () => {
  it('renders a chip per node type', () => {
    render(<GraphFilterBar />);

    for (const type of Object.values(NodeType)) {
      expect(screen.getByRole('button', { name: `Toggle ${type}` })).toBeInTheDocument();
    }
  });

  it('toggles a node type off and on through the store', () => {
    render(<GraphFilterBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Controller' }));
    expect(useGraphStore.getState().visibleNodeTypes).not.toContain(NodeType.CONTROLLER);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Controller' }));
    expect(useGraphStore.getState().visibleNodeTypes).toContain(NodeType.CONTROLLER);
  });

  it('All / None quick buttons show or hide every type', () => {
    render(<GraphFilterBar />);

    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(useGraphStore.getState().visibleNodeTypes).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(useGraphStore.getState().visibleNodeTypes).toEqual(Object.values(NodeType));
  });
});

describe('GraphFilterBar — edge toggles', () => {
  it('toggles an edge type through the store', () => {
    render(<GraphFilterBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle edge DEPENDS_ON' }));

    expect(useGraphStore.getState().visibleEdgeTypes).not.toContain(EdgeType.DEPENDS_ON);
  });
});

describe('GraphFilterBar — layer filter', () => {
  it('sets the layer filter through the store', () => {
    render(<GraphFilterBar />);

    fireEvent.change(screen.getByLabelText(/layer/i), { target: { value: 'domain' } });

    expect(useGraphStore.getState().layerFilter).toBe('domain');
  });

  it('clears the layer filter back to all layers', () => {
    act(() => {
      useGraphStore.getState().setLayerFilter('application');
    });
    render(<GraphFilterBar />);

    fireEvent.change(screen.getByLabelText(/layer/i), { target: { value: '' } });

    expect(useGraphStore.getState().layerFilter).toBeNull();
  });
});

describe('GraphFilterBar — hide toggles', () => {
  it('hides external deps when toggled on', () => {
    render(<GraphFilterBar />);

    fireEvent.click(screen.getByRole('button', { name: /hide external deps/i }));

    expect(useGraphStore.getState().showExternal).toBe(false);
  });

  it('hides deprecated nodes when toggled on', () => {
    render(<GraphFilterBar />);

    fireEvent.click(screen.getByRole('button', { name: /hide deprecated/i }));

    expect(useGraphStore.getState().showDeprecated).toBe(false);
  });
});

describe('GraphFilterBar — active filter count', () => {
  it('shows the "N filters active" badge', () => {
    act(() => {
      useGraphStore.getState().toggleNodeType(NodeType.CONTROLLER);
      useGraphStore.getState().toggleEdgeType(EdgeType.EXPOSES);
      useGraphStore.getState().setShowExternal(false);
    });
    render(<GraphFilterBar />);

    expect(screen.getByText('3 filters active')).toBeInTheDocument();
  });

  it('hides the badge when no filters are active', () => {
    render(<GraphFilterBar />);

    expect(screen.queryByText(/filters active/i)).not.toBeInTheDocument();
  });
});

describe('GraphFilterBar — reset', () => {
  it('resets all filters with the reset link', () => {
    act(() => {
      useGraphStore.getState().toggleNodeType(NodeType.CONTROLLER);
      useGraphStore.getState().setLayerFilter('domain');
      useGraphStore.getState().setShowDeprecated(false);
      useGraphStore.getState().setSearchQuery('auth');
    });
    render(<GraphFilterBar />);

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));

    const state = useGraphStore.getState();
    expect(state.visibleNodeTypes).toEqual(Object.values(NodeType));
    expect(state.visibleEdgeTypes).toEqual(Object.values(EdgeType));
    expect(state.layerFilter).toBeNull();
    expect(state.showExternal).toBe(true);
    expect(state.showDeprecated).toBe(true);
    expect(state.searchQuery).toBe('');
  });
});

describe('GraphFilterBar — search', () => {
  it('writes the search query to the store', () => {
    render(<GraphFilterBar />);

    fireEvent.change(screen.getByLabelText(/search nodes/i), { target: { value: 'auth' } });

    expect(useGraphStore.getState().searchQuery).toBe('auth');
  });

  it('fires onSearchSubmit when Enter is pressed', () => {
    const onSubmit = vi.fn();
    render(<GraphFilterBar onSearchSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText(/search nodes/i), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
