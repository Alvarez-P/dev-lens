/**
 * Visualization domain types — mirrors of the Knowledge Graph backend
 * contract (NodeType/EdgeType enums, GraphNode/GraphEdge JSON, snapshot
 * summary) plus the client-side normalization/UI types.
 */

/** Mirror of the backend `NodeType` enum (16 members). */
export enum NodeType {
  PROJECT = 'Project',
  PACKAGE = 'Package',
  MODULE = 'Module',
  CONTROLLER = 'Controller',
  SERVICE = 'Service',
  REPOSITORY = 'Repository',
  ENTITY = 'Entity',
  DTO = 'DTO',
  INTERFACE = 'Interface',
  ENDPOINT = 'Endpoint',
  EXTERNAL_DEPENDENCY = 'ExternalDependency',
  GUARD = 'Guard',
  PIPE = 'Pipe',
  INTERCEPTOR = 'Interceptor',
  MIDDLEWARE = 'Middleware',
  UNKNOWN = 'Unknown',
}

/** Mirror of the backend `EdgeType` enum (10 members). */
export enum EdgeType {
  BELONGS_TO = 'BELONGS_TO',
  IMPLEMENTS = 'IMPLEMENTS',
  EXTENDS = 'EXTENDS',
  IMPORTS = 'IMPORTS',
  DEPENDS_ON = 'DEPENDS_ON',
  EXPOSES = 'EXPOSES',
  PROTECTS = 'PROTECTS',
  TRANSFORMS = 'TRANSFORMS',
  INVOKES = 'INVOKES',
  INJECTS = 'INJECTS',
}

/** Mirror of the backend `BuildStatus` enum. */
export enum SnapshotStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  BUILT = 'built',
  FAILED = 'failed',
}

/** Layout algorithms supported by the renderer adapters. */
export enum LayoutType {
  FORCE = 'force',
  HIERARCHICAL = 'hierarchical',
  RADIAL = 'radial',
  CIRCULAR = 'circular',
}

/** The 8 visualization views (VV-001). */
export enum ViewMode {
  OVERVIEW = 'overview',
  MODULES = 'modules',
  DEPENDENCY_TREE = 'dependency-tree',
  API_EXPLORER = 'api-explorer',
  LAYER_ARCHITECTURE = 'layer-architecture',
  DOMAIN_RELATIONSHIPS = 'domain-relationships',
  EVENT_FLOW = 'event-flow',
  REQUEST_FLOW = 'request-flow',
}

/** Type guard: is `value` a known NodeType? */
export function isNodeType(value: string): value is NodeType {
  return Object.values(NodeType).includes(value as NodeType);
}

/** Type guard: is `value` a known EdgeType? */
export function isEdgeType(value: string): value is EdgeType {
  return Object.values(EdgeType).includes(value as EdgeType);
}

/** A single graph node as returned by the KG API (backend `GraphNodeJson`). */
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  fqn: string;
  properties: Record<string, unknown>;
  repoId: string;
  version: number;
  deprecatedAt: string | null;
}

/** A single directed graph edge as returned by the KG API (backend `GraphEdgeJson`). */
export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, unknown>;
  version: number;
}

/** Latest graph snapshot summary (backend `GraphSnapshotSummary`). */
export interface GraphSnapshot {
  snapshotId: string;
  repositoryId: string;
  analysisId: string;
  commitSha: string;
  version: number;
  nodeCount: number;
  edgeCount: number;
  status: SnapshotStatus;
  createdAt: string;
}

/** Flat node/edge arrays normalized into id-keyed Maps. */
export interface NormalizedGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

/** Incoming/outgoing neighbor indices keyed by node id. */
export interface AdjacencyIndex {
  incoming: Map<string, string[]>;
  outgoing: Map<string, string[]>;
}

/** Canvas viewport state (pan + zoom). */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Full-graph export response payload. */
export interface GraphExport {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    nodeCount: number;
    edgeCount: number;
    version: number;
  };
}

/** Node detail (node + connected edges) response payload. */
export interface GraphNodeDetail {
  node: GraphNode;
  edges: GraphEdge[];
}

/** A positioned graph node produced by a layout engine (VE-002). */
export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

/** A positioned edge (source/target node ids) produced by a layout engine. */
export interface EdgePosition {
  id: string;
  source: string;
  target: string;
}

/** Layout engine output: node/edge positions ready for the renderer. */
export interface LayoutResult {
  nodes: NodePosition[];
  edges: EdgePosition[];
}

/** Layout engine signature injected into renderer adapters (VE-002). */
export type LayoutEngine = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  layout: LayoutType,
) => LayoutResult;

/** Mirror of the backend `FlowStepKind` union — lifecycle step roles. */
export type FlowStepKind =
  'middleware' | 'guard' | 'pipe' | 'interceptor' | 'handler' | 'service' | 'repository';

/** One ordered lifecycle step (mirror of backend `RequestFlowStep`). */
export interface RequestFlowStep {
  order: number;
  kind: FlowStepKind;
  nodeFqn: string;
  nodeLabel: string;
  /** Graph edge type connecting this step toward the flow (REQ-VV-006). */
  edgeType: EdgeType;
  /** DTO type annotation from the endpoint's typedParams (handler steps only). */
  payloadType: string | null;
  /** True for the INVOKES-derived service tail (inferred, not from method bodies). */
  approximate: boolean;
}

/** Aggregated request flow for one endpoint: endpoint + ordered lifecycle steps. */
export interface RequestFlow {
  endpointFqn: string;
  steps: RequestFlowStep[];
}

/** `GET /graph/:repoId/endpoints/:fqn/flow` response (mirror of backend `EndpointFlowResponse`). */
export interface EndpointFlowResponse {
  /** False for snapshots below the flow-data graph version (REQ-VV-010). */
  flowAvailable: boolean;
  steps: RequestFlowStep[];
  endpointFqn: string;
}

/** Minimum graph snapshot version carrying request-flow data (mirror of backend `GRAPH_FLOW_VERSION`). */
export const FLOW_DATA_GRAPH_VERSION = 2;
