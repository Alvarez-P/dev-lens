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

/** Mirror of the backend `EdgeType` enum (8 members). */
export enum EdgeType {
  BELONGS_TO = 'BELONGS_TO',
  IMPLEMENTS = 'IMPLEMENTS',
  EXTENDS = 'EXTENDS',
  IMPORTS = 'IMPORTS',
  DEPENDS_ON = 'DEPENDS_ON',
  EXPOSES = 'EXPOSES',
  PROTECTS = 'PROTECTS',
  TRANSFORMS = 'TRANSFORMS',
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

/** The 7 visualization views (VV-001). */
export enum ViewMode {
  OVERVIEW = 'overview',
  MODULES = 'modules',
  DEPENDENCY_TREE = 'dependency-tree',
  API_EXPLORER = 'api-explorer',
  LAYER_ARCHITECTURE = 'layer-architecture',
  DOMAIN_RELATIONSHIPS = 'domain-relationships',
  EVENT_FLOW = 'event-flow',
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
