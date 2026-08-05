import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { NodeType, EdgeType, LayoutType, ViewMode } from '../types';
import type { Viewport } from '../types';

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

export interface GraphStore extends SelectionSlice, ViewSlice, FilterSlice, NavigationSlice {}

const createSelectionSlice: StateCreator<GraphStore, [], [], SelectionSlice> = (set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,

  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
  setSelectedEdge: (selectedEdgeId) => set({ selectedEdgeId }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),
});

const createViewSlice: StateCreator<GraphStore, [], [], ViewSlice> = (set) => ({
  viewMode: ViewMode.OVERVIEW,
  layout: LayoutType.FORCE,
  viewport: { x: 0, y: 0, zoom: 1 },

  setViewMode: (viewMode) => set({ viewMode }),
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

/**
 * Single Zustand store combining the four slices (VI-001 selection,
 * VV-001 view, VV-002 filters, GN-003/004/005 navigation).
 */
export const useGraphStore = create<GraphStore>()((set, get, api) => ({
  ...createSelectionSlice(set, get, api),
  ...createViewSlice(set, get, api),
  ...createFilterSlice(set, get, api),
  ...createNavigationSlice(set, get, api),
}));
