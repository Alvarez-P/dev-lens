import { NodeType, EdgeType, LayoutType, ViewMode } from './types';
import { useGraphStore } from './store/graph-store';

/**
 * The 7 visualization views (REQ-VV-001 view→layout/filter table). Each
 * config maps a ViewMode to the layout algorithm and the node/edge filters
 * applied when the view is selected. Views 5–6 derive layer/domain
 * assignment client-side via filePath heuristics (VV-003); view 7 is a
 * placeholder empty state.
 */
export interface ViewConfig {
  mode: ViewMode;
  /** Chip label shown in the view switcher. */
  label: string;
  /** One-line description (tooltip / empty states). */
  description: string;
  layout: LayoutType;
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
  /** True for views that render a placeholder instead of the canvas. */
  isEmptyState?: boolean;
}

const ALL_NODE_TYPES = Object.values(NodeType);
const ALL_EDGE_TYPES = Object.values(EdgeType);

export const VIEWS: ViewConfig[] = [
  {
    mode: ViewMode.OVERVIEW,
    label: 'Overview',
    description: 'Full graph in a force-directed layout.',
    layout: LayoutType.FORCE,
    nodeTypes: [...ALL_NODE_TYPES],
    edgeTypes: [...ALL_EDGE_TYPES],
  },
  {
    mode: ViewMode.MODULES,
    label: 'Module Dependencies',
    description: 'Module nodes connected by DEPENDS_ON edges, top-down hierarchy.',
    layout: LayoutType.HIERARCHICAL,
    nodeTypes: [NodeType.MODULE],
    edgeTypes: [EdgeType.DEPENDS_ON],
  },
  {
    mode: ViewMode.DEPENDENCY_TREE,
    label: 'Dependency Tree',
    description: 'EXPOSES edges from the focused root arranged radially.',
    layout: LayoutType.RADIAL,
    nodeTypes: [...ALL_NODE_TYPES],
    edgeTypes: [EdgeType.EXPOSES],
  },
  {
    mode: ViewMode.API_EXPLORER,
    label: 'API Explorer',
    description: 'Endpoints grouped under their module via EXPOSES / BELONGS_TO.',
    layout: LayoutType.HIERARCHICAL,
    nodeTypes: [NodeType.ENDPOINT, NodeType.MODULE],
    edgeTypes: [EdgeType.EXPOSES, EdgeType.BELONGS_TO],
  },
  {
    mode: ViewMode.LAYER_ARCHITECTURE,
    label: 'Layer Architecture',
    description: 'All nodes color-coded by the layer derived from their file path.',
    layout: LayoutType.FORCE,
    nodeTypes: [...ALL_NODE_TYPES],
    edgeTypes: [...ALL_EDGE_TYPES],
  },
  {
    mode: ViewMode.DOMAIN_RELATIONSHIPS,
    label: 'Domain Relationships',
    description: 'All nodes grouped by the domain derived from their file path.',
    layout: LayoutType.FORCE,
    nodeTypes: [...ALL_NODE_TYPES],
    edgeTypes: [...ALL_EDGE_TYPES],
  },
  {
    mode: ViewMode.EVENT_FLOW,
    label: 'Event Flow',
    description:
      'Event data is not yet available. Event flow visualization will be available in a future update.',
    layout: LayoutType.FORCE,
    nodeTypes: [],
    edgeTypes: [],
    isEmptyState: true,
  },
  {
    mode: ViewMode.REQUEST_FLOW,
    label: 'Request Flow',
    description:
      'Select an endpoint to visualize its request flow. The canvas shows the ordered lifecycle steps the request travels through.',
    layout: LayoutType.HIERARCHICAL,
    nodeTypes: [...ALL_NODE_TYPES],
    edgeTypes: [EdgeType.PROTECTS, EdgeType.TRANSFORMS, EdgeType.INVOKES, EdgeType.INJECTS],
  },
];

/** Resolve the config for a view mode (throws on unknown modes). */
export function getViewConfig(mode: ViewMode): ViewConfig {
  const config = VIEWS.find((view) => view.mode === mode);
  if (!config) {
    throw new Error(`Unknown view mode: ${mode}`);
  }
  return config;
}

/**
 * Switch views in one store transaction (VV-001): sets the view mode, the
 * layout the view prescribes, and the view's node/edge filters. Used by the
 * toolbar chips and the 1–8 keyboard shortcuts.
 *
 * REQ-VV-008: leaving REQUEST_FLOW for another view resets the flow slice
 * (stops playback and clears the loaded flow).
 */
export function applyViewMode(mode: ViewMode): void {
  const config = getViewConfig(mode);
  const state = useGraphStore.getState();

  if (state.viewMode !== mode && state.viewMode === ViewMode.REQUEST_FLOW) {
    state.resetFlow();
  }

  useGraphStore.setState({
    viewMode: mode,
    layout: config.layout,
    visibleNodeTypes: config.nodeTypes,
    visibleEdgeTypes: config.edgeTypes,
  });
}
