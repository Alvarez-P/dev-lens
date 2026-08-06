import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NodeType } from '@/lib/visualization/types';
import type { GraphNode } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { findMatches, useGraphSearch } from '../use-graph-search';

function makeNode(id: string, label: string, fqn: string): GraphNode {
  return {
    id,
    type: NodeType.SERVICE,
    label,
    fqn,
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
  };
}

const nodes = [
  makeNode('svc-auth', 'AuthService', 'my-project:auth:AuthService'),
  makeNode('ctrl-auth', 'AuthController', 'my-project:auth:AuthController'),
  makeNode('svc-orders', 'OrdersService', 'my-project:orders:OrdersService'),
];

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

describe('findMatches (pure, REQ-VV-003)', () => {
  it('matches by label substring', () => {
    expect(findMatches(nodes, 'AuthService')).toEqual(['svc-auth']);
  });

  it('matches by FQN substring', () => {
    expect(findMatches(nodes, 'orders:Orders')).toEqual(['svc-orders']);
  });

  it('matches case-insensitively on label and fqn', () => {
    expect(findMatches(nodes, 'authservice')).toEqual(['svc-auth']);
    expect(findMatches(nodes, 'MY-PROJECT:AUTH')).toEqual(['svc-auth', 'ctrl-auth']);
  });

  it('returns every node whose label or fqn contains the query', () => {
    expect(findMatches(nodes, 'auth')).toEqual(['svc-auth', 'ctrl-auth']);
  });

  it('returns an empty list for a no-match or empty query', () => {
    expect(findMatches(nodes, 'zzz-no-match')).toEqual([]);
    expect(findMatches(nodes, '')).toEqual([]);
    expect(findMatches(nodes, '   ')).toEqual([]);
  });
});

describe('useGraphSearch', () => {
  it('writes the query to the store and mirrors it back', () => {
    const { result } = renderHook(() => useGraphSearch(nodes));

    act(() => result.current.setQuery('auth'));

    expect(useGraphStore.getState().searchQuery).toBe('auth');
    expect(result.current.query).toBe('auth');
    expect(result.current.isSearching).toBe(true);
  });

  it('computes matching node ids from the current query', () => {
    const { result } = renderHook(() => useGraphSearch(nodes));

    expect(result.current.isSearching).toBe(false);
    expect(result.current.matchingNodeIds).toEqual([]);

    act(() => result.current.setQuery('auth'));
    expect(result.current.matchingNodeIds).toEqual(['svc-auth', 'ctrl-auth']);
  });

  it('clears the search back to a non-searching state', () => {
    const { result } = renderHook(() => useGraphSearch(nodes));

    act(() => result.current.setQuery('auth'));
    act(() => result.current.clearSearch());

    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(useGraphStore.getState().searchQuery).toBe('');
  });

  it('centers the viewport on the first match on submit', () => {
    const centerOn = vi.fn();
    const adapterRef = {
      current: {
        centerOn,
        highlight: vi.fn(),
        clearHighlights: vi.fn(),
      } as unknown as GraphRendererAdapter,
    };
    const { result } = renderHook(() => useGraphSearch(nodes, adapterRef));

    act(() => result.current.setQuery('orders'));
    act(() => result.current.submit());

    expect(centerOn).toHaveBeenCalledWith('svc-orders');
  });

  it('does not center when there are no matches', () => {
    const centerOn = vi.fn();
    const adapterRef = {
      current: {
        centerOn,
        highlight: vi.fn(),
        clearHighlights: vi.fn(),
      } as unknown as GraphRendererAdapter,
    };
    const { result } = renderHook(() => useGraphSearch(nodes, adapterRef));

    act(() => result.current.setQuery('zzz-no-match'));
    act(() => result.current.submit());

    expect(centerOn).not.toHaveBeenCalled();
  });

  it('highlights matching nodes and clears highlights when the query empties', () => {
    const highlight = vi.fn();
    const clearHighlights = vi.fn();
    const adapterRef = {
      current: { highlight, clearHighlights } as unknown as GraphRendererAdapter,
    };
    const { result } = renderHook(() => useGraphSearch(nodes, adapterRef));

    act(() => result.current.setQuery('auth'));
    expect(highlight).toHaveBeenCalledWith(['svc-auth', 'ctrl-auth']);

    act(() => result.current.clearSearch());
    expect(clearHighlights).toHaveBeenCalled();
  });

  it('does not touch the adapter while no search is active', () => {
    const highlight = vi.fn();
    const clearHighlights = vi.fn();
    const adapterRef = {
      current: { highlight, clearHighlights } as unknown as GraphRendererAdapter,
    };

    renderHook(() => useGraphSearch(nodes, adapterRef));

    expect(highlight).not.toHaveBeenCalled();
    expect(clearHighlights).not.toHaveBeenCalled();
  });
});
