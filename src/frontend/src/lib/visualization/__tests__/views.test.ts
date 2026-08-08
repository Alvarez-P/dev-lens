import { describe, it, expect, beforeEach } from 'vitest';
import { NodeType, EdgeType, LayoutType, ViewMode } from '../types';
import { useGraphStore } from '../store/graph-store';
import type { GraphStore } from '../store/graph-store';
import { getViewConfig, applyViewMode, VIEWS } from '../views';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

describe('getViewConfig (VV-001 view→layout/filter table)', () => {
  it('returns a complete config for every view mode', () => {
    for (const mode of Object.values(ViewMode)) {
      const config = getViewConfig(mode);

      expect(config.mode).toBe(mode);
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.description.length).toBeGreaterThan(0);
    }
  });

  it('Overview shows all node and edge types with a force layout', () => {
    const config = getViewConfig(ViewMode.OVERVIEW);

    expect(config.layout).toBe(LayoutType.FORCE);
    expect(config.nodeTypes).toEqual(Object.values(NodeType));
    expect(config.edgeTypes).toEqual(Object.values(EdgeType));
    expect(config.isEmptyState).toBeFalsy();
  });

  it('Module Dependencies shows MODULE nodes with DEPENDS_ON edges, hierarchical', () => {
    const config = getViewConfig(ViewMode.MODULES);

    expect(config.layout).toBe(LayoutType.HIERARCHICAL);
    expect(config.nodeTypes).toEqual([NodeType.MODULE]);
    expect(config.edgeTypes).toEqual([EdgeType.DEPENDS_ON]);
  });

  it('Dependency Tree keeps all types with EXPOSES edges and a radial layout', () => {
    const config = getViewConfig(ViewMode.DEPENDENCY_TREE);

    expect(config.layout).toBe(LayoutType.RADIAL);
    expect(config.edgeTypes).toEqual([EdgeType.EXPOSES]);
  });

  it('API Explorer shows ENDPOINT and MODULE nodes with EXPOSES/BELONGS_TO edges', () => {
    const config = getViewConfig(ViewMode.API_EXPLORER);

    expect(config.layout).toBe(LayoutType.HIERARCHICAL);
    expect(config.nodeTypes).toEqual([NodeType.ENDPOINT, NodeType.MODULE]);
    expect(config.edgeTypes).toEqual([EdgeType.EXPOSES, EdgeType.BELONGS_TO]);
  });

  it('Layer Architecture keeps all types/edges (layers derived client-side)', () => {
    const config = getViewConfig(ViewMode.LAYER_ARCHITECTURE);

    expect(config.layout).toBe(LayoutType.FORCE);
    expect(config.nodeTypes).toEqual(Object.values(NodeType));
    expect(config.edgeTypes).toEqual(Object.values(EdgeType));
  });

  it('Domain Relationships keeps all types/edges (domains derived client-side)', () => {
    const config = getViewConfig(ViewMode.DOMAIN_RELATIONSHIPS);

    expect(config.layout).toBe(LayoutType.FORCE);
    expect(config.nodeTypes).toEqual(Object.values(NodeType));
    expect(config.edgeTypes).toEqual(Object.values(EdgeType));
  });

  it('Event Flow returns an empty-state config', () => {
    const config = getViewConfig(ViewMode.EVENT_FLOW);

    expect(config.isEmptyState).toBe(true);
    expect(config.nodeTypes).toEqual([]);
    expect(config.edgeTypes).toEqual([]);
  });

  it('Request Flow is a hierarchical lifecycle-edge view (not an empty state)', () => {
    const config = getViewConfig(ViewMode.REQUEST_FLOW);

    expect(config.layout).toBe(LayoutType.HIERARCHICAL);
    expect(config.isEmptyState).toBeFalsy();
    expect(config.label).toBe('Request Flow');
    expect(config.description).toContain('Select an endpoint');
    expect(config.edgeTypes).toEqual([
      EdgeType.PROTECTS,
      EdgeType.TRANSFORMS,
      EdgeType.INVOKES,
      EdgeType.INJECTS,
    ]);
  });
});

describe('VIEWS', () => {
  it('exposes exactly 8 views in view-number order', () => {
    expect(VIEWS).toHaveLength(8);
    expect(VIEWS.map((view) => view.mode)).toEqual(Object.values(ViewMode));
  });
});

describe('applyViewMode', () => {
  it('updates the store view, layout and view filters in one step', () => {
    useGraphStore.getState().setViewMode(ViewMode.OVERVIEW);

    applyViewMode(ViewMode.MODULES);

    const state = useGraphStore.getState();
    expect(state.viewMode).toBe(ViewMode.MODULES);
    expect(state.layout).toBe(LayoutType.HIERARCHICAL);
    expect(state.visibleNodeTypes).toEqual([NodeType.MODULE]);
    expect(state.visibleEdgeTypes).toEqual([EdgeType.DEPENDS_ON]);
  });

  it('an Event Flow switch clears the visible filters', () => {
    applyViewMode(ViewMode.EVENT_FLOW);

    const state = useGraphStore.getState();
    expect(state.viewMode).toBe(ViewMode.EVENT_FLOW);
    expect(state.visibleNodeTypes).toEqual([]);
    expect(state.visibleEdgeTypes).toEqual([]);
  });

  it('leaving REQUEST_FLOW via applyViewMode resets the flow slice (REQ-VV-008)', () => {
    applyViewMode(ViewMode.REQUEST_FLOW);
    useGraphStore.getState().startFlow('fqn-A', [
      {
        order: 0,
        kind: 'guard',
        nodeFqn: 'fqn-guard',
        nodeLabel: 'JwtAuthGuard',
        edgeType: EdgeType.PROTECTS,
        payloadType: null,
        approximate: false,
      },
    ]);
    useGraphStore.getState().nextStep();

    applyViewMode(ViewMode.MODULES);

    const state = useGraphStore.getState();
    expect(state.viewMode).toBe(ViewMode.MODULES);
    expect(state.activeEndpointFqn).toBeNull();
    expect(state.flowSteps).toEqual([]);
    expect(state.currentStepIndex).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it('switching to REQUEST_FLOW itself does not reset an existing flow', () => {
    applyViewMode(ViewMode.REQUEST_FLOW);
    useGraphStore.getState().startFlow('fqn-A', [
      {
        order: 0,
        kind: 'handler',
        nodeFqn: 'fqn-handler',
        nodeLabel: 'login()',
        edgeType: EdgeType.EXPOSES,
        payloadType: 'LoginDto',
        approximate: false,
      },
    ]);

    applyViewMode(ViewMode.REQUEST_FLOW);

    expect(useGraphStore.getState().activeEndpointFqn).toBe('fqn-A');
  });
});
