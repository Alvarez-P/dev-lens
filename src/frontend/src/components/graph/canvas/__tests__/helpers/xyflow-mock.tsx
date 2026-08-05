/**
 * Test double for `@xyflow/react` used by component tests under
 * `components/graph/canvas/__tests__`. React Flow 12 relies on browser
 * measurement APIs (ResizeObserver, getBoundingClientRect) that jsdom does
 * not implement, so component tests drive a lightweight fake that faithfully
 * replicates the wiring surface the production code depends on:
 *
 * - renders `nodes`/`edges` as DOM elements (clickable), mirroring RF's
 *   controlled-component contract
 * - exposes imperative view controls via `useReactFlow` (spy-backed)
 * - captures the latest ReactFlow props for config assertions
 */
import { vi } from 'vitest';
import { createContext, forwardRef, useContext, useImperativeHandle } from 'react';
import type { ReactNode, CSSProperties } from 'react';

export const mockReactFlowApi = {
  fitView: vi.fn().mockResolvedValue(true),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomTo: vi.fn(),
  setViewport: vi.fn(),
  getViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
  setCenter: vi.fn(),
};

export function resetMockReactFlowApi(): void {
  for (const spy of Object.values(mockReactFlowApi)) {
    spy.mockClear();
  }
  mockReactFlowApi.getViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });
  for (const key of Object.keys(capturedReactFlowProps)) {
    delete capturedReactFlowProps[key];
  }
}

const ReactFlowContext = createContext(mockReactFlowApi);

export function useReactFlow(): typeof mockReactFlowApi {
  return useContext(ReactFlowContext);
}

export function ReactFlowProvider({ children }: { children: ReactNode }): ReactNode {
  return <ReactFlowContext.Provider value={mockReactFlowApi}>{children}</ReactFlowContext.Provider>;
}

interface MockFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  className?: string;
  hidden?: boolean;
  selected?: boolean;
  data?: { node?: { label?: string } };
}

interface MockFlowEdge {
  id: string;
  source: string;
  target: string;
  hidden?: boolean;
  data?: unknown;
}

export interface CapturedReactFlowProps {
  nodes: MockFlowNode[];
  edges: MockFlowEdge[];
  minZoom?: number;
  maxZoom?: number;
  onlyRenderVisibleElements?: boolean;
  nodeTypes?: Record<string, unknown>;
  edgeTypes?: Record<string, unknown>;
  onNodeClick?: (event: unknown, node: MockFlowNode) => void;
  onNodeDoubleClick?: (event: unknown, node: MockFlowNode) => void;
  onEdgeClick?: (event: unknown, edge: MockFlowEdge) => void;
  onPaneClick?: () => void;
  onMoveStart?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
  onMoveEnd?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
  [key: string]: unknown;
}

export const capturedReactFlowProps: CapturedReactFlowProps = { nodes: [], edges: [] };

export const ReactFlow = forwardRef<unknown, CapturedReactFlowProps>(
  function ReactFlow(props, ref) {
    Object.assign(capturedReactFlowProps, props);
    useImperativeHandle(ref, () => ({}));
    const {
      nodes = [],
      edges = [],
      onNodeClick,
      onNodeDoubleClick,
      onEdgeClick,
      onPaneClick,
      minZoom,
      maxZoom,
      onlyRenderVisibleElements,
    } = props as CapturedReactFlowProps;

    return (
      <div
        data-testid="react-flow"
        data-min-zoom={minZoom}
        data-max-zoom={maxZoom}
        data-only-visible={onlyRenderVisibleElements}
      >
        {nodes
          .filter((node) => !node.hidden)
          .map((node) => (
            <div
              key={node.id}
              data-testid={`rf-node-${node.id}`}
              data-node-type={node.type}
              data-dimmed={node.className?.includes('dimmed') ? 'true' : undefined}
              data-selected={node.selected ? 'true' : undefined}
              onClick={(event) => onNodeClick?.(event, node)}
              onDoubleClick={(event) => onNodeDoubleClick?.(event, node)}
            >
              {node.data?.node?.label ?? node.id}
            </div>
          ))}
        {edges
          .filter((edge) => !edge.hidden)
          .map((edge) => (
            <div
              key={edge.id}
              data-testid={`rf-edge-${edge.id}`}
              onClick={(event) => onEdgeClick?.(event, edge)}
            >
              {edge.id}
            </div>
          ))}
        <div data-testid="rf-pane" onClick={() => onPaneClick?.()} />
        <div data-testid="rf-minimap" />
        <div data-testid="rf-controls" />
        <div data-testid="rf-background" />
      </div>
    );
  },
);
ReactFlow.displayName = 'ReactFlow';

export function Background(): ReactNode {
  return <div data-testid="rf-background" />;
}

export function Controls(): ReactNode {
  return <div data-testid="rf-controls" />;
}

export function MiniMap(): ReactNode {
  return <div data-testid="rf-minimap" />;
}

export function Handle(): ReactNode {
  return <div data-testid="rf-handle" />;
}

export const Position = { Left: 'left', Top: 'top', Right: 'right', Bottom: 'bottom' } as const;

export const MarkerType = { ArrowClosed: 'arrowclosed' } as const;

export const BackgroundVariant = { Dots: 'dots', Lines: 'lines', Cross: 'cross' } as const;

interface MockBaseEdgeProps {
  id?: string;
  path: string;
  style?: CSSProperties;
  markerEnd?: unknown;
}

export function BaseEdge({ id, path, style, markerEnd }: MockBaseEdgeProps): ReactNode {
  return (
    <path
      data-testid={id ? `edge-path-${id}` : 'edge-path'}
      data-has-marker={markerEnd ? 'true' : undefined}
      data-dash={style?.strokeDasharray}
      data-stroke={style?.stroke}
      d={path}
      style={style}
    />
  );
}

export function EdgeLabelRenderer({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}

export function getBezierPath(): readonly [string, { x: number; y: number }] {
  return ['M 0 0', { x: 0, y: 0 }] as const;
}

/** The full module surface production code imports from `@xyflow/react`. */
export const xyflowMock = {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
};
