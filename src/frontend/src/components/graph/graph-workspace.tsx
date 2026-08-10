'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Activity, AlertTriangle, Filter, GitFork, RefreshCw } from 'lucide-react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { ViewMode, NodeType, FLOW_DATA_GRAPH_VERSION } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
import { isSuccessResponse } from '@/lib/api-client';
import { getEndpointFlow } from '@/lib/visualization/graph-api';
import type { GraphDirection } from '@/lib/visualization/graph-api';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { useProgressiveLoad, mergeNodes } from '@/lib/visualization/hooks/use-progressive-load';
import { useGraphExport } from '@/lib/visualization/hooks/use-graph-export';
import { useDrillDown, applyFocusMode } from '@/lib/visualization/hooks/use-drill-down';
import { useKeyboardShortcuts } from '@/lib/visualization/hooks/use-keyboard-shortcuts';
import { useGraphSearch } from '@/lib/visualization/hooks/use-graph-search';
import { useNodeDetail } from '@/lib/visualization/hooks/use-node-detail';
import { useFlowAnimation } from '@/lib/visualization/hooks/use-flow-animation';
import { filterGraph } from './canvas/filter';
import { GraphBreadcrumbs } from './graph-breadcrumbs';
import { GraphToolbar } from './graph-toolbar';
import { GraphFilterBar } from './graph-filter-bar';
import { GraphCanvas } from './canvas/graph-canvas';
import { GraphDetailPanel } from './graph-detail-panel';
import { GraphContextMenu } from './graph-context-menu';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';
import { LoadingState } from '@/components/molecules/loading-state';
import { Badge } from '@/components/atoms/badge';

/** Merge two edge lists by id, keeping the incoming edge for duplicates. */
export function mergeEdges(existing: GraphEdge[], incoming: GraphEdge[]): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();
  for (const edge of existing) byId.set(edge.id, edge);
  for (const edge of incoming) byId.set(edge.id, edge);
  return Array.from(byId.values());
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

export interface GraphWorkspaceProps {
  repoId: string;
  className?: string;
}

/**
 * Full graph page orchestrator (component tree in design.md): breadcrumbs,
 * toolbar (view switcher), filter bar, canvas, detail panel and context menu.
 * Wires progressive chunk loading (GN-001), drill-down/focus mode (GN-002/004),
 * client-side search (VV-003) and keyboard shortcuts (VI-005), and owns the
 * loading / error / empty / no-results / Event-Flow placeholder states.
 */
export function GraphWorkspace({ repoId, className }: GraphWorkspaceProps): React.ReactNode {
  const adapterRef = useRef<GraphRendererAdapter>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [neighborhood, setNeighborhood] = useState<{
    fqn: string;
    direction: GraphDirection;
  } | null>(null);
  const [extraNodes, setExtraNodes] = useState<GraphNode[]>([]);
  const [extraEdges, setExtraEdges] = useState<GraphEdge[]>([]);
  // REQ-VV-010: set when the flow API reports flowAvailable false for a click.
  const [flowUnavailable, setFlowUnavailable] = useState(false);
  // Bumped on every flow start so re-clicking the same endpoint restarts the
  // token animation (the token identity includes this run id).
  const flowRunRef = useRef(0);

  // Flow playback controller (REQ-VV-007): advances steps / stops at the end.
  useFlowAnimation();

  // Progressive node streaming + full edge set from the export endpoint.
  const load = useProgressiveLoad(repoId, {
    onVersionChange: () => {
      // Pulsed via the "Sync detected" badge (GN-005).
    },
  });
  const exportQuery = useGraphExport(repoId, load.snapshotVersion);

  const exportEdges = useMemo(() => exportQuery.data?.edges ?? [], [exportQuery.data]);
  const allNodes = useMemo(() => mergeNodes(load.nodes, extraNodes), [load.nodes, extraNodes]);
  const allEdges = useMemo(() => mergeEdges(exportEdges, extraEdges), [exportEdges, extraEdges]);

  const drillDown = useDrillDown(repoId, allNodes, {
    onMerge: (detail) => {
      setExtraNodes((previous) => mergeNodes(previous, [detail.node]));
      setExtraEdges((previous) => mergeEdges(previous, detail.edges));
    },
    onNavigate: (nodeId) => {
      if (nodeId) {
        adapterRef.current?.centerOn(nodeId);
      } else {
        adapterRef.current?.fitView();
      }
    },
  });

  useKeyboardShortcuts({
    adapterRef,
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  const search = useGraphSearch(allNodes, adapterRef);

  // Show Dependencies / Show Dependents from the detail panel: fetch the
  // direction-filtered neighborhood, merge it and center on the node.
  const detailQuery = useNodeDetail(
    repoId,
    neighborhood?.fqn ?? '',
    neighborhood?.direction ?? 'out',
  );
  useEffect(() => {
    if (detailQuery.data && neighborhood) {
      setExtraNodes((previous) => mergeNodes(previous, [detailQuery.data!.node]));
      setExtraEdges((previous) => mergeEdges(previous, detailQuery.data!.edges));
      adapterRef.current?.centerOn(detailQuery.data!.node.id);
    }
  }, [detailQuery.data, neighborhood]);

  const viewMode = useGraphStore((state) => state.viewMode);
  const visibleNodeTypes = useGraphStore((state) => state.visibleNodeTypes);
  const visibleEdgeTypes = useGraphStore((state) => state.visibleEdgeTypes);
  const showExternal = useGraphStore((state) => state.showExternal);
  const showDeprecated = useGraphStore((state) => state.showDeprecated);
  const layerFilter = useGraphStore((state) => state.layerFilter);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const resetFilters = useGraphStore((state) => state.resetFilters);
  const setFocusNode = useGraphStore((state) => state.setFocusNode);
  const flowSteps = useGraphStore((state) => state.flowSteps);
  const currentStepIndex = useGraphStore((state) => state.currentStepIndex);
  const activeEndpointFqn = useGraphStore((state) => state.activeEndpointFqn);
  const startFlow = useGraphStore((state) => state.startFlow);

  const filtered = useMemo(
    () =>
      filterGraph(allNodes, allEdges, {
        visibleNodeTypes,
        visibleEdgeTypes,
        showExternal,
        showDeprecated,
        layerFilter,
        searchQuery,
      }),
    [
      allNodes,
      allEdges,
      visibleNodeTypes,
      visibleEdgeTypes,
      showExternal,
      showDeprecated,
      layerFilter,
      searchQuery,
    ],
  );

  // Focus mode (GN-004): restrict to the focused node + 1-hop neighbors.
  const { nodes: focusNodes, edges: focusEdges } = useMemo(
    () => applyFocusMode(filtered.nodes, filtered.edges, drillDown.focusNodeId),
    [filtered, drillDown.focusNodeId],
  );

  const error = load.error ?? exportQuery.error ?? null;
  const hasData = load.nodeCount > 0 || allNodes.length > 0;
  const showEventFlow = viewMode === ViewMode.EVENT_FLOW;
  const noResults = !error && hasData && !showEventFlow && filtered.nodes.length === 0;

  const retry = (): void => {
    load.refresh();
    void exportQuery.refetch();
  };

  const handleShowNeighborhood = (nodeId: string, direction: 'in' | 'out'): void => {
    const node = allNodes.find((candidate) => candidate.id === nodeId);
    if (node) {
      setNeighborhood({ fqn: node.fqn, direction });
    }
  };

  const isFlowView = viewMode === ViewMode.REQUEST_FLOW;
  const isFlowUnavailable =
    isFlowView && ((load.snapshotVersion ?? 0) < FLOW_DATA_GRAPH_VERSION || flowUnavailable);

  // REQ-VV-010: a fresh snapshot (post re-analysis) makes the flow available
  // again, so drop the API-level unavailable flag when leaving the view.
  useEffect(() => {
    if (viewMode !== ViewMode.REQUEST_FLOW) {
      setFlowUnavailable(false);
    }
  }, [viewMode]);

  /** REQ-VV-006: fetch the endpoint flow and start playback. */
  const loadEndpointFlow = useCallback(
    async (fqn: string): Promise<void> => {
      const response = await getEndpointFlow(repoId, fqn);
      if (!isSuccessResponse(response) || !response.data) {
        return; // leave the current flow state untouched on failure
      }
      if (!response.data.flowAvailable) {
        setFlowUnavailable(true); // REQ-VV-010: no flow data to fabricate
        return;
      }
      flowRunRef.current += 1;
      startFlow(response.data.endpointFqn, response.data.steps);
    },
    [repoId, startFlow],
  );

  /**
   * REQ-VV-006/010: in REQUEST_FLOW view, only endpoint nodes trigger a flow
   * fetch; every other node is ignored and the loaded flow/prompt persists.
   * Outside the flow view the default select-on-click behavior applies.
   */
  const handleNodeClick = (nodeId: string): void => {
    if (!isFlowView) {
      useGraphStore.getState().setSelectedNode(nodeId);
      return;
    }
    if (isFlowUnavailable) return; // old snapshot → nothing is selectable
    const node = allNodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.type !== NodeType.ENDPOINT) return;
    useGraphStore.getState().setSelectedNode(nodeId);
    void loadEndpointFlow(node.fqn);
  };

  // REQ-VV-007: annotate the edge between the current step pair with an
  // animation token so EdgePath travels a token along it. The token changes on
  // every step advance (and every flow start via flowRunRef) — edges only care
  // that the value changed, so the same token never restarts an in-flight run.
  const flowEdgeTokens = useMemo(() => {
    if (!isFlowView || flowSteps.length === 0) {
      return null;
    }
    const fromStep = flowSteps[currentStepIndex];
    const toStep = flowSteps[currentStepIndex + 1];
    if (!fromStep || !toStep) {
      return null;
    }
    const nodeByFqn = new Map(allNodes.map((node) => [node.fqn, node] as const));
    const fromId = nodeByFqn.get(fromStep.nodeFqn)?.id;
    const toId = nodeByFqn.get(toStep.nodeFqn)?.id;
    if (!fromId || !toId) {
      return null;
    }
    const token = `${activeEndpointFqn ?? fromStep.nodeFqn}#${flowRunRef.current}#${currentStepIndex}`;
    const tokens = new Map<string, string>();
    for (const edge of focusEdges) {
      if (edge.sourceNodeId === fromId && edge.targetNodeId === toId) {
        tokens.set(edge.id, token);
      }
    }
    return tokens;
  }, [isFlowView, flowSteps, currentStepIndex, activeEndpointFqn, focusEdges, allNodes]);

  const flowEdges = useMemo(() => {
    if (!flowEdgeTokens) {
      return focusEdges;
    }
    return focusEdges.map((edge) => {
      const token = flowEdgeTokens.get(edge.id);
      return token ? { ...edge, properties: { ...edge.properties, animationToken: token } } : edge;
    });
  }, [focusEdges, flowEdgeTokens]);

  const contextMenuNode = menu ? allNodes.find((candidate) => candidate.id === menu.nodeId) : null;

  const renderCanvasArea = (): React.ReactNode => {
    if (error) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<AlertTriangle className="h-10 w-10" aria-hidden="true" />}
            title="Something went wrong loading the graph."
            description={error.message}
            action={
              <Button
                variant="secondary"
                onClick={retry}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Retry
              </Button>
            }
          />
        </div>
      );
    }

    if (load.isLoading) {
      return (
        <LoadingState
          variant="overlay"
          label={`Loading ${load.nodeCount > 0 ? `${load.nodeCount} nodes...` : 'graph...'}`}
        />
      );
    }

    if (!hasData) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<GitFork className="h-10 w-10" aria-hidden="true" />}
            title="No graph data yet"
            description="Run a sync to analyze this repository and generate its dependency graph."
            action={
              <Link
                href={`/repositories/${repoId}/sync`}
                className="inline-flex items-center justify-center rounded-lg bg-white/[0.05] px-4 py-2 text-sm font-medium text-surface-200 transition-colors hover:bg-white/[0.08]"
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Run sync
              </Link>
            }
          />
        </div>
      );
    }

    if (showEventFlow) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<Activity className="h-10 w-10" aria-hidden="true" />}
            title="Event data is not yet available"
            description="Event flow visualization will be available in a future update."
          />
        </div>
      );
    }

    if (isFlowUnavailable) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<Activity className="h-10 w-10" aria-hidden="true" />}
            title="Flow data is not available for this snapshot"
            description="Re-analyze the repository to enable request-flow visualization."
          />
        </div>
      );
    }

    if (noResults) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<Filter className="h-10 w-10" aria-hidden="true" />}
            title="No nodes match your filters"
            description="Try adjusting the filter criteria."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <div className="relative h-full w-full">
        <GraphCanvas
          nodes={focusNodes}
          edges={flowEdges}
          adapterRef={adapterRef}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={drillDown.handleNodeDoubleClick}
          onNodeContextMenu={(nodeId, position) =>
            setMenu({ nodeId, x: position.x, y: position.y })
          }
        />
        {isFlowView && flowSteps.length === 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center"
            role="status"
          >
            <span className="rounded-full border border-white/[0.06] bg-surface-900/80 px-4 py-2 text-sm text-surface-300 backdrop-blur-sm">
              Select an endpoint to visualize its request flow.
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={clsx('flex h-full min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <GraphBreadcrumbs onNavigateTo={drillDown.navigateTo} />

        {load.changedNodeIds.length > 0 && (
          <Badge variant="success">
            Sync detected — {load.changedNodeIds.length} nodes updated
          </Badge>
        )}
      </div>

      <GraphToolbar />

      <GraphFilterBar searchInputRef={searchInputRef} onSearchSubmit={search.submit} />

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.04] bg-surface-950">
          {renderCanvasArea()}

          {contextMenuNode && menu && (
            <GraphContextMenu
              node={contextMenuNode}
              x={menu.x}
              y={menu.y}
              onShowDependencies={(nodeId) => {
                setFocusNode(nodeId);
                handleShowNeighborhood(nodeId, 'out');
              }}
              onShowDependents={(nodeId) => {
                setFocusNode(nodeId);
                handleShowNeighborhood(nodeId, 'in');
              }}
              onCenterOnNode={(nodeId) => adapterRef.current?.centerOn(nodeId)}
              onClose={() => setMenu(null)}
            />
          )}
        </div>

        <GraphDetailPanel
          nodes={allNodes}
          edges={allEdges}
          isDetailLoading={drillDown.isExpanding}
          onShowNeighborhood={handleShowNeighborhood}
        />
      </div>
    </div>
  );
}
