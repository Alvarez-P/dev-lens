import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { NodeType, EdgeType, LayoutType, ViewMode } from '../types';
import type { Viewport, RequestFlowStep } from '../types';

const ALL_NODE_TYPES = Object.values(NodeType);
const ALL_EDGE_TYPES = Object.values(EdgeType);

export interface SelectionSlice {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  clearSelection: () => void;
}

export interface ViewSlice {
  viewMode: ViewMode;
  layout: LayoutType;
  viewport: Viewport;
  setViewMode: (mode: ViewMode) => void;
  setLayout: (layout: LayoutType) => void;
  setViewport: (viewport: Viewport) => void;
}

export interface FilterSlice {
  visibleNodeTypes: NodeType[];
  visibleEdgeTypes: EdgeType[];
  showExternal: boolean;
  showDeprecated: boolean;
  layerFilter: string | null;
  searchQuery: string;
  setVisibleNodeTypes: (types: NodeType[]) => void;
  toggleNodeType: (type: NodeType) => void;
  setVisibleEdgeTypes: (types: EdgeType[]) => void;
  toggleEdgeType: (type: EdgeType) => void;
  setShowExternal: (show: boolean) => void;
  setShowDeprecated: (show: boolean) => void;
  setLayerFilter: (layer: string | null) => void;
  setSearchQuery: (query: string) => void;
  /** Restore every filter to its default (VV-002 "Reset filters"). */
  resetFilters: () => void;
}

export interface NavigationSlice {
  breadcrumbs: string[];
  focusNodeId: string | null;
  pushBreadcrumb: (segment: string) => void;
  popBreadcrumb: () => void;
  /** Keep segments 0..index — clicking a breadcrumb segment navigates back to it (GN-003). */
  truncateBreadcrumbs: (index: number) => void;
  clearBreadcrumbs: () => void;
  setFocusNode: (id: string | null) => void;
  clearFocus: () => void;
}

/** Progressive chunk-loading progress (GN-001): 0..1 fraction of nodes loaded. */
export interface LoadingSlice {
  loadProgress: number;
  setLoadProgress: (progress: number) => void;
}

/**
 * Request-flow playback state (REQ-VV-008). Loaded via `startFlow(fqn, steps)`
 * after an endpoint click in the REQUEST_FLOW view; cleared by `resetFlow()`
 * when the view changes away from REQUEST_FLOW or on navigation.
 */
export interface FlowSlice {
  /** FQN of the endpoint whose flow is currently loaded (null when none). */
  activeEndpointFqn: string | null;
  /** Ordered lifecycle steps returned by the flow API. */
  flowSteps: RequestFlowStep[];
  /** Index of the lifecycle step the token animation is currently on. */
  currentStepIndex: number;
  /** True while the token animation is advancing. */
  isPlaying: boolean;
  /** Token travel speed multiplier (1x default). */
  animationSpeed: number;
  /** Load a flow: sets the endpoint, resets the step index and starts playback. */
  startFlow: (endpointFqn: string, steps: RequestFlowStep[]) => void;
  /** Advance to the next lifecycle step (clamped at the final step). */
  nextStep: () => void;
  /** Stop playback, keeping the loaded flow in place. */
  pauseFlow: () => void;
  /** Clear every flow field and stop playback (REQ-VV-008 view-switch reset). */
  resetFlow: () => void;
}

export interface GraphStore
  extends SelectionSlice, ViewSlice, FilterSlice, NavigationSlice, LoadingSlice, FlowSlice {}

const createSelectionSlice: StateCreator<GraphStore, [], [], SelectionSlice> = (set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,

  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
  setSelectedEdge: (selectedEdgeId) => set({ selectedEdgeId }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),
});

const createViewSlice: StateCreator<GraphStore, [], [], ViewSlice> = (set, get) => ({
  viewMode: ViewMode.OVERVIEW,
  layout: LayoutType.FORCE,
  viewport: { x: 0, y: 0, zoom: 1 },

  setViewMode: (viewMode) => {
    // REQ-VV-008: leaving REQUEST_FLOW resets the flow slice (stops playback).
    const state = get();
    if (state.viewMode !== viewMode && state.viewMode === ViewMode.REQUEST_FLOW) {
      state.resetFlow();
    }
    set({ viewMode });
  },
  setLayout: (layout) => set({ layout }),
  setViewport: (viewport) => set({ viewport }),
});

const createFilterSlice: StateCreator<GraphStore, [], [], FilterSlice> = (set) => ({
  visibleNodeTypes: [...ALL_NODE_TYPES],
  visibleEdgeTypes: [...ALL_EDGE_TYPES],
  showExternal: true,
  showDeprecated: true,
  layerFilter: null,
  searchQuery: '',

  setVisibleNodeTypes: (visibleNodeTypes) => set({ visibleNodeTypes }),
  toggleNodeType: (type) =>
    set((state) => ({
      visibleNodeTypes: state.visibleNodeTypes.includes(type)
        ? state.visibleNodeTypes.filter((candidate) => candidate !== type)
        : [...state.visibleNodeTypes, type],
    })),
  setVisibleEdgeTypes: (visibleEdgeTypes) => set({ visibleEdgeTypes }),
  toggleEdgeType: (type) =>
    set((state) => ({
      visibleEdgeTypes: state.visibleEdgeTypes.includes(type)
        ? state.visibleEdgeTypes.filter((candidate) => candidate !== type)
        : [...state.visibleEdgeTypes, type],
    })),
  setShowExternal: (showExternal) => set({ showExternal }),
  setShowDeprecated: (showDeprecated) => set({ showDeprecated }),
  setLayerFilter: (layerFilter) => set({ layerFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetFilters: () =>
    set({
      visibleNodeTypes: [...ALL_NODE_TYPES],
      visibleEdgeTypes: [...ALL_EDGE_TYPES],
      showExternal: true,
      showDeprecated: true,
      layerFilter: null,
      searchQuery: '',
    }),
});

const createNavigationSlice: StateCreator<GraphStore, [], [], NavigationSlice> = (set) => ({
  breadcrumbs: [],
  focusNodeId: null,

  pushBreadcrumb: (segment) => set((state) => ({ breadcrumbs: [...state.breadcrumbs, segment] })),
  popBreadcrumb: () => set((state) => ({ breadcrumbs: state.breadcrumbs.slice(0, -1) })),
  truncateBreadcrumbs: (index) =>
    set((state) => ({ breadcrumbs: state.breadcrumbs.slice(0, index + 1) })),
  clearBreadcrumbs: () => set({ breadcrumbs: [] }),
  setFocusNode: (focusNodeId) => set({ focusNodeId }),
  clearFocus: () => set({ focusNodeId: null }),
});

const createLoadingSlice: StateCreator<GraphStore, [], [], LoadingSlice> = (set) => ({
  loadProgress: 0,

  setLoadProgress: (loadProgress) => set({ loadProgress: Math.min(Math.max(loadProgress, 0), 1) }),
});

const createFlowSlice: StateCreator<GraphStore, [], [], FlowSlice> = (set) => ({
  activeEndpointFqn: null,
  flowSteps: [],
  currentStepIndex: 0,
  isPlaying: false,
  animationSpeed: 1,

  startFlow: (endpointFqn, flowSteps) =>
    set({ activeEndpointFqn: endpointFqn, flowSteps, currentStepIndex: 0, isPlaying: true }),

  nextStep: () =>
    set((state) => ({
      // Clamp at the final step so the token never advances past the lifecycle.
      currentStepIndex:
        state.flowSteps.length === 0
          ? 0
          : Math.min(state.currentStepIndex + 1, state.flowSteps.length - 1),
    })),

  pauseFlow: () => set({ isPlaying: false }),

  resetFlow: () =>
    set({ activeEndpointFqn: null, flowSteps: [], currentStepIndex: 0, isPlaying: false }),
});

/**
 * Single Zustand store combining the slices (VI-001 selection, VV-001 view,
 * VV-002 filters, GN-003/004/005 navigation, REQ-VV-008 request flow).
 */
export const useGraphStore = create<GraphStore>()((set, get, api) => ({
  ...createSelectionSlice(set, get, api),
  ...createViewSlice(set, get, api),
  ...createFilterSlice(set, get, api),
  ...createNavigationSlice(set, get, api),
  ...createLoadingSlice(set, get, api),
  ...createFlowSlice(set, get, api),
}));
