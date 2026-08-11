'use client';

import { clsx } from 'clsx';
import { X, MousePointer2, ArrowRight, Waypoints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GraphNode, GraphEdge, RequestFlowStep } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { NODE_STYLE } from './canvas/nodes/node-style';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import { EmptyState } from '@/components/molecules/empty-state';
import { AIAnalysisPanel } from './ai-analysis-panel';

/** camelCase property keys → Title Case display labels ('fileName' → 'File Name'). */
export function titleCaseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^[a-z]/, (first) => first.toUpperCase());
}

/** Count incoming (target) and outgoing (source) edges touching a node id. */
export function countEdgeStats(
  nodeId: string,
  edges: GraphEdge[],
): { incoming: number; outgoing: number } {
  let incoming = 0;
  let outgoing = 0;

  for (const edge of edges) {
    if (edge.targetNodeId === nodeId) incoming += 1;
    if (edge.sourceNodeId === nodeId) outgoing += 1;
  }

  return { incoming, outgoing };
}

export interface GraphDetailPanelProps {
  /** Loaded graph nodes used to resolve the selected node/edge endpoints. */
  nodes: GraphNode[];
  /** Loaded graph edges used for the edge-detail variant and edge counts. */
  edges: GraphEdge[];
  /** True while the node detail / neighborhood is being fetched (VI-001). */
  isDetailLoading?: boolean;
  /**
   * Fired by the action buttons so the workspace can load the neighborhood
   * and re-center — with the direction the button represents.
   */
  onShowNeighborhood?: (nodeId: string, direction: 'in' | 'out') => void;
  className?: string;
}

/**
 * Right-side detail panel (w-80, glass surface). Shows the selected node's
 * type icon/badge, FQN, formatted properties, edge counts and neighborhood
 * actions, or the selected edge's endpoints and type. Mounts only while a
 * selection exists, so `animate-slide-in` fires on open but not on switch.
 */
export function GraphDetailPanel({
  nodes,
  edges,
  isDetailLoading = false,
  onShowNeighborhood,
  className,
}: GraphDetailPanelProps): React.ReactNode {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const flowSteps = useGraphStore((state) => state.flowSteps);
  const activeEndpointFqn = useGraphStore((state) => state.activeEndpointFqn);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  // REQ-VV-007/009: while a flow is loaded, the panel body shows the step list.
  const isFlowActive = activeEndpointFqn !== null && flowSteps.length > 0;

  const isClosed = !selectedNodeId && !selectedEdgeId && !isFlowActive;

  return (
    <div
      role="region"
      aria-label="Graph detail panel"
      className={clsx(
        'flex h-full w-80 flex-col overflow-y-auto',
        'border-l border-white/[0.04] bg-surface-900/70 backdrop-blur-md',
        isClosed ? 'justify-center' : 'animate-slide-in',
        className,
      )}
    >
      {isClosed ? (
        <EmptyState
          icon={<MousePointer2 className="h-8 w-8 opacity-30" />}
          title="Select a node to view details"
          description="Click a node on the canvas to inspect its properties, dependencies and dependents."
        />
      ) : (
        <>
          <header className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-6 py-4">
            <div className="min-w-0">
              {selectedNode && !isDetailLoading ? <NodeHeader node={selectedNode} /> : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close details"
              onClick={clearSelection}
              leftIcon={<X className="h-4 w-4" />}
              className="shrink-0"
            />
          </header>

          <div className="flex-1 px-6 py-4">
            {isFlowActive ? (
              <FlowStepList steps={flowSteps} endpointFqn={activeEndpointFqn} />
            ) : selectedNodeId ? (
              isDetailLoading ? (
                <div aria-label="Loading node details">
                  <Skeleton width="70%" height="0.75rem" className="mb-3" />
                  <Skeleton width="100%" height="2rem" className="mb-4" />
                  <Skeleton width="90%" height="0.75rem" className="mb-2" />
                  <Skeleton width="85%" height="0.75rem" className="mb-2" />
                  <Skeleton width="95%" height="0.75rem" />
                </div>
              ) : selectedNode ? (
                <div className="space-y-5">
                  <NodeDetails
                    node={selectedNode}
                    edges={edges}
                    onShowNeighborhood={onShowNeighborhood}
                  />
                  <AIAnalysisPanel node={selectedNode} />
                </div>
              ) : (
                <EmptyState
                  title="Node unavailable"
                  description="This node is not part of the loaded graph."
                />
              )
            ) : selectedEdge ? (
              <EdgeDetails edge={selectedEdge} nodes={nodes} />
            ) : (
              <EmptyState
                title="Edge unavailable"
                description="This edge is not part of the loaded graph."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NodeHeader({ node }: { node: GraphNode }): React.ReactNode {
  const style = NODE_STYLE[node.type];
  const Icon: LucideIcon = style.icon;

  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05]">
        <Icon className="h-5 w-5" aria-label="Node type icon" style={{ color: style.accent }} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-surface-100">{node.label}</h3>
          <Badge variant={style.badgeVariant}>{node.type}</Badge>
          {node.deprecatedAt ? (
            <Badge variant="error" size="sm">
              Deprecated
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-surface-400">{node.fqn}</p>
      </div>
    </div>
  );
}

function NodeDetails({
  node,
  edges,
  onShowNeighborhood,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  onShowNeighborhood?: (nodeId: string, direction: 'in' | 'out') => void;
}): React.ReactNode {
  const setFocusNode = useGraphStore((state) => state.setFocusNode);
  const { incoming, outgoing } = countEdgeStats(node.id, edges);
  const properties = Object.entries(node.properties);

  const showNeighborhood = (direction: 'in' | 'out'): void => {
    setFocusNode(node.id);
    onShowNeighborhood?.(node.id, direction);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span
          aria-label="Incoming edges"
          className="rounded-lg bg-white/[0.04] px-3 py-2 text-center"
        >
          <span className="block text-lg font-semibold text-surface-100">{incoming}</span>
          <span className="block text-xs uppercase tracking-wide text-surface-500">In</span>
        </span>
        <span
          aria-label="Outgoing edges"
          className="rounded-lg bg-white/[0.04] px-3 py-2 text-center"
        >
          <span className="block text-lg font-semibold text-surface-100">{outgoing}</span>
          <span className="block text-xs uppercase tracking-wide text-surface-500">Out</span>
        </span>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => showNeighborhood('out')}>
          Show Dependencies
        </Button>
        <Button variant="secondary" size="sm" onClick={() => showNeighborhood('in')}>
          Show Dependents
        </Button>
      </div>

      {properties.length > 0 && (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Node properties</caption>
          <tbody>
            {properties.map(([key, value]) => (
              <tr key={key} className="border-b border-white/[0.04] last:border-0">
                <th
                  scope="row"
                  className="w-2/5 py-1.5 pr-4 text-left align-top text-xs font-medium whitespace-nowrap text-surface-500"
                >
                  {titleCaseKey(key)}
                </th>
                <td className="w-3/5 py-1.5 text-right align-top font-mono text-xs break-all text-surface-200">
                  {String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EdgeDetails({ edge, nodes }: { edge: GraphEdge; nodes: GraphNode[] }): React.ReactNode {
  const source = nodes.find((node) => node.id === edge.sourceNodeId);
  const target = nodes.find((node) => node.id === edge.targetNodeId);
  const properties = Object.entries(edge.properties);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-medium text-surface-100">
          {source?.label ?? edge.sourceNodeId}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-surface-500" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium text-surface-100">
          {target?.label ?? edge.targetNodeId}
        </span>
      </div>

      <Badge variant="default" size="md">
        {edge.type}
      </Badge>

      {properties.length > 0 && (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Edge properties</caption>
          <tbody>
            {properties.map(([key, value]) => (
              <tr key={key} className="border-b border-white/[0.04] last:border-0">
                <th
                  scope="row"
                  className="w-2/5 py-1.5 pr-4 text-left align-top text-xs font-medium whitespace-nowrap text-surface-500"
                >
                  {titleCaseKey(key)}
                </th>
                <td className="w-3/5 py-1.5 text-right align-top font-mono text-xs break-all text-surface-200">
                  {String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * REQ-VV-007/009: ordered request-flow step list for the active flow. Each
 * step row shows its order, kind badge, label, optional DTO payload type, and
 * an `(approx)` muted badge when the step is part of the inferred service
 * tail. The connector below each step represents its outgoing edge — dashed
 * (violet) for approximate steps, solid (muted) for accurate ones.
 */
function FlowStepList({
  steps,
  endpointFqn,
}: {
  steps: RequestFlowStep[];
  endpointFqn: string;
}): React.ReactNode {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Waypoints className="h-4 w-4 text-surface-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-surface-100">Request Flow</h3>
      </div>

      <p className="truncate font-mono text-xs text-surface-400">{endpointFqn}</p>

      <ol aria-label="Request flow steps" className="space-y-1">
        {steps.map((step, index) => (
          <li key={step.order} className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[10px] font-medium text-surface-400"
              >
                {step.order}
              </span>
              <Badge variant="default" size="sm">
                {step.kind}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-surface-200">
                {step.nodeLabel}
              </span>
              {step.approximate && (
                <span className="shrink-0 text-xs text-surface-500/80">(approx)</span>
              )}
            </div>

            {step.payloadType && (
              <p className="pl-8 font-mono text-xs text-surface-400">payload: {step.payloadType}</p>
            )}

            {index < steps.length - 1 && (
              <svg
                data-testid={`flow-connector-${step.order}`}
                data-approximate={step.approximate ? 'true' : undefined}
                aria-hidden="true"
                className="ml-[11px] mt-1 block h-3 w-3"
              >
                <line
                  x1="6"
                  y1="0"
                  x2="6"
                  y2="12"
                  stroke={step.approximate ? '#a78bfa' : '#3f3f46'}
                  strokeWidth="1.5"
                  strokeDasharray={step.approximate ? '3 2' : undefined}
                />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
