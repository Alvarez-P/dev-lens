import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../graph-store';
import type { GraphStore } from '../graph-store';
import { NodeType, EdgeType, LayoutType, ViewMode } from '../../types';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  // Restore pristine state (actions included) before every test.
  useGraphStore.setState(initialState, true);
});

describe('selectionSlice', () => {
  it('starts with no node or edge selected', () => {
    const state = useGraphStore.getState();

    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedEdgeId).toBeNull();
  });

  it('selects and re-selects a node without touching the edge selection', () => {
    useGraphStore.getState().setSelectedNode('node-1');
    expect(useGraphStore.getState().selectedNodeId).toBe('node-1');
    expect(useGraphStore.getState().selectedEdgeId).toBeNull();

    useGraphStore.getState().setSelectedNode('node-2');
    expect(useGraphStore.getState().selectedNodeId).toBe('node-2');
  });

  it('selects an edge', () => {
    useGraphStore.getState().setSelectedEdge('edge-1');
    expect(useGraphStore.getState().selectedEdgeId).toBe('edge-1');
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });

  it('clearSelection resets both selections', () => {
    useGraphStore.getState().setSelectedNode('node-1');
    useGraphStore.getState().setSelectedEdge('edge-1');

    useGraphStore.getState().clearSelection();

    expect(useGraphStore.getState().selectedNodeId).toBeNull();
    expect(useGraphStore.getState().selectedEdgeId).toBeNull();
  });

  it('deselects a node by passing null', () => {
    useGraphStore.getState().setSelectedNode('node-1');
    useGraphStore.getState().setSelectedNode(null);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });
});

describe('viewSlice', () => {
  it('defaults to the Overview view with the force layout and a 1:1 viewport', () => {
    const state = useGraphStore.getState();

    expect(state.viewMode).toBe(ViewMode.OVERVIEW);
    expect(state.layout).toBe(LayoutType.FORCE);
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('switches the view mode', () => {
    useGraphStore.getState().setViewMode(ViewMode.MODULES);
    expect(useGraphStore.getState().viewMode).toBe(ViewMode.MODULES);

    useGraphStore.getState().setViewMode(ViewMode.DEPENDENCY_TREE);
    expect(useGraphStore.getState().viewMode).toBe(ViewMode.DEPENDENCY_TREE);
  });

  it('switches the layout', () => {
    useGraphStore.getState().setLayout(LayoutType.HIERARCHICAL);
    expect(useGraphStore.getState().layout).toBe(LayoutType.HIERARCHICAL);
  });

  it('stores the viewport', () => {
    useGraphStore.getState().setViewport({ x: 120, y: -40, zoom: 1.5 });
    expect(useGraphStore.getState().viewport).toEqual({ x: 120, y: -40, zoom: 1.5 });
  });
});

describe('filterSlice', () => {
  it('defaults to every node and edge type visible, external shown, deprecated shown', () => {
    const state = useGraphStore.getState();

    expect(state.visibleNodeTypes).toEqual(Object.values(NodeType));
    expect(state.visibleEdgeTypes).toEqual(Object.values(EdgeType));
    expect(state.showExternal).toBe(true);
    expect(state.showDeprecated).toBe(true);
    expect(state.layerFilter).toBeNull();
    expect(state.searchQuery).toBe('');
  });

  it('toggleNodeType removes and re-adds a type', () => {
    useGraphStore.getState().toggleNodeType(NodeType.CONTROLLER);
    expect(useGraphStore.getState().visibleNodeTypes).not.toContain(NodeType.CONTROLLER);
    expect(useGraphStore.getState().visibleNodeTypes).toHaveLength(
      Object.values(NodeType).length - 1,
    );

    useGraphStore.getState().toggleNodeType(NodeType.CONTROLLER);
    expect(useGraphStore.getState().visibleNodeTypes).toContain(NodeType.CONTROLLER);
    expect(useGraphStore.getState().visibleNodeTypes).toHaveLength(Object.values(NodeType).length);
  });

  it('toggleEdgeType removes and re-adds an edge type', () => {
    useGraphStore.getState().toggleEdgeType(EdgeType.DEPENDS_ON);
    expect(useGraphStore.getState().visibleEdgeTypes).not.toContain(EdgeType.DEPENDS_ON);

    useGraphStore.getState().toggleEdgeType(EdgeType.DEPENDS_ON);
    expect(useGraphStore.getState().visibleEdgeTypes).toContain(EdgeType.DEPENDS_ON);
  });

  it('setVisibleNodeTypes replaces the whole allowlist', () => {
    useGraphStore.getState().setVisibleNodeTypes([NodeType.MODULE, NodeType.SERVICE]);
    expect(useGraphStore.getState().visibleNodeTypes).toEqual([NodeType.MODULE, NodeType.SERVICE]);
  });

  it('setVisibleEdgeTypes replaces the whole allowlist', () => {
    useGraphStore.getState().setVisibleEdgeTypes([EdgeType.EXPOSES]);
    expect(useGraphStore.getState().visibleEdgeTypes).toEqual([EdgeType.EXPOSES]);
  });

  it('toggles external and deprecated visibility', () => {
    useGraphStore.getState().setShowExternal(false);
    expect(useGraphStore.getState().showExternal).toBe(false);

    useGraphStore.getState().setShowDeprecated(false);
    expect(useGraphStore.getState().showDeprecated).toBe(false);

    useGraphStore.getState().setShowExternal(true);
    useGraphStore.getState().setShowDeprecated(true);
    expect(useGraphStore.getState().showExternal).toBe(true);
    expect(useGraphStore.getState().showDeprecated).toBe(true);
  });

  it('sets the layer filter and search query', () => {
    useGraphStore.getState().setLayerFilter('domain');
    expect(useGraphStore.getState().layerFilter).toBe('domain');

    useGraphStore.getState().setLayerFilter(null);
    expect(useGraphStore.getState().layerFilter).toBeNull();

    useGraphStore.getState().setSearchQuery('Auth');
    expect(useGraphStore.getState().searchQuery).toBe('Auth');
  });
});

describe('navigationSlice', () => {
  it('starts with an empty breadcrumb trail and no focus', () => {
    const state = useGraphStore.getState();

    expect(state.breadcrumbs).toEqual([]);
    expect(state.focusNodeId).toBeNull();
  });

  it('pushBreadcrumb appends segments to the trail', () => {
    useGraphStore.getState().pushBreadcrumb('my-repo');
    useGraphStore.getState().pushBreadcrumb('my-pkg');
    useGraphStore.getState().pushBreadcrumb('AuthModule');

    expect(useGraphStore.getState().breadcrumbs).toEqual(['my-repo', 'my-pkg', 'AuthModule']);
  });

  it('popBreadcrumb removes the last segment (back-navigation)', () => {
    useGraphStore.getState().pushBreadcrumb('my-repo');
    useGraphStore.getState().pushBreadcrumb('my-pkg');

    useGraphStore.getState().popBreadcrumb();

    expect(useGraphStore.getState().breadcrumbs).toEqual(['my-repo']);
  });

  it('popBreadcrumb is a no-op on an empty trail', () => {
    useGraphStore.getState().popBreadcrumb();

    expect(useGraphStore.getState().breadcrumbs).toEqual([]);
  });

  it('sets and clears the focused node', () => {
    useGraphStore.getState().setFocusNode('node-1');
    expect(useGraphStore.getState().focusNodeId).toBe('node-1');

    useGraphStore.getState().clearFocus();
    expect(useGraphStore.getState().focusNodeId).toBeNull();
  });
});
