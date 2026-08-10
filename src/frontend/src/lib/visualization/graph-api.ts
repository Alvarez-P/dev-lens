import { get } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type {
  GraphSnapshot,
  GraphNode,
  GraphExport,
  GraphNodeDetail,
  NodeType,
  EndpointFlowResponse,
} from './types';

export type GraphDirection = 'in' | 'out' | 'both';

export interface GraphNodesParams {
  version?: number;
  type?: NodeType | NodeType[];
  page?: number;
  limit?: number;
}

type QueryValue = string | number | boolean | Array<string | number | boolean> | null | undefined;

/**
 * Serialize query params into a URL query string. Array values become
 * repeated `type[]` keys (type%5B%5D=A&type%5B%5D=B) which Express' qs
 * parser decodes to `type[]` arrays — matching the KG API multi-type
 * contract. `undefined` and `null` values are skipped.
 */
export function buildQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(`${key}[]`, String(item));
      }
    } else {
      search.append(key, String(value));
    }
  }

  return search.toString();
}

function withQuery(path: string, query: string): string {
  return query.length > 0 ? `${path}?${query}` : path;
}

/** GET /api/v1/graph/:repoId — latest graph snapshot summary. */
export function getGraphSnapshot(repoId: string): Promise<ApiResponse<GraphSnapshot>> {
  return get<GraphSnapshot>(`/api/v1/graph/${repoId}`);
}

/** GET /api/v1/graph/:repoId/export — full graph (nodes + edges + meta). */
export function getGraphExport(
  repoId: string,
  version?: number,
): Promise<ApiResponse<GraphExport | null>> {
  return get<GraphExport | null>(
    withQuery(`/api/v1/graph/${repoId}/export`, buildQueryString({ version })),
  );
}

/** GET /api/v1/graph/:repoId/nodes — paginated nodes, optional version/type filter. */
export function getGraphNodes(
  repoId: string,
  params: GraphNodesParams = {},
): Promise<ApiResponse<GraphNode[]>> {
  const types = params.type === undefined ? undefined : ([] as NodeType[]).concat(params.type);

  const query = buildQueryString({
    version: params.version,
    page: params.page,
    limit: params.limit,
    type: types,
  });

  return get<GraphNode[]>(withQuery(`/api/v1/graph/${repoId}/nodes`, query));
}

/** GET /api/v1/graph/:repoId/nodes/:fqn — node detail with direction-filtered edges. */
export function getNodeDetail(
  repoId: string,
  fqn: string,
  direction?: GraphDirection,
): Promise<ApiResponse<GraphNodeDetail>> {
  const query = buildQueryString({ direction });

  return get<GraphNodeDetail>(
    withQuery(`/api/v1/graph/${repoId}/nodes/${encodeURIComponent(fqn)}`, query),
  );
}

/**
 * GET /api/v1/graph/:repoId/endpoints/:fqn/flow — ordered lifecycle steps for
 * an endpoint (REQ-VV-006). The FQN is percent-encoded so `:` separators and
 * `#` fragment markers survive the URL path.
 */
export function getEndpointFlow(
  repoId: string,
  fqn: string,
): Promise<ApiResponse<EndpointFlowResponse | null>> {
  return get<EndpointFlowResponse | null>(
    `/api/v1/graph/${repoId}/endpoints/${encodeURIComponent(fqn)}/flow`,
  );
}
