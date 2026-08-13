import { DocType } from '../../domain/doc-type.enum';
import { SectionFormat } from '../../domain/doc-template';
import {
  GeneratedDocument,
  DocSection,
  DocTableContent,
  DocMarkdownContent,
  DocJsonContent,
} from '../../domain/doc-document';
import { GraphNode } from '../../../knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '../../../knowledge-graph/domain/graph-edge.vo';
import { IDocContentGenerator, DocContext } from './content-generator.interface';
import { buildGeneratedDocument, extractEndpoints } from './graph-content';

/** OpenAPI-shaped payload consumed by the OpenAPI renderer (documentation-formats R4). */
export interface OpenApiDocData {
  title: string;
  version: string;
  endpoints: Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    parameters?: Array<{
      name: string;
      in: 'query' | 'path' | 'header' | 'cookie';
      required?: boolean;
      schema?: { type: string };
    }>;
    requestBody?: { schemaName?: string; required?: boolean };
    responses?: Array<{ status: number; description: string; schemaName?: string }>;
  }>;
  schemas: Array<{
    name: string;
    fields?: Array<{ name: string; type: string; required?: boolean }>;
  }>;
}

/**
 * AI-enrich placeholder: the DocEnricherService fills these sections and
 * always produces Markdown (enrichedSection() forces SectionFormat.MARKDOWN),
 * so placeholders carry an empty markdown body from the start.
 */
function aiPlaceholder(id: string, title: string): DocSection {
  return {
    id,
    title,
    format: SectionFormat.MARKDOWN,
    content: { markdown: '' } as DocMarkdownContent,
    aiGenerated: false,
  };
}

function endpointTable(
  endpoints: Array<{ method: string; path: string; controller: string }>,
): DocSection {
  const content: DocTableContent = {
    columns: ['Method', 'Path', 'Controller'],
    rows: endpoints.map((endpoint) => ({
      Method: endpoint.method,
      Path: endpoint.path,
      Controller: endpoint.controller,
    })),
  };
  return { id: 'endpoint-list', title: 'Endpoint List', format: SectionFormat.TABLE, content };
}

function openApiExport(
  title: string,
  version: string,
  endpoints: Array<{ method: string; path: string }>,
): DocSection {
  const data: OpenApiDocData = {
    title,
    version,
    endpoints: endpoints.map((endpoint) => ({
      method: endpoint.method.toLowerCase(),
      path: endpoint.path,
      summary: `${endpoint.method} ${endpoint.path}`,
      responses: [],
    })),
    schemas: [],
  };
  const content: DocJsonContent = { data };
  return { id: 'openapi-export', title: 'OpenAPI Export', format: SectionFormat.JSON, content };
}

/**
 * API-reference content generator (built-in api-reference v1 template;
 * template R2/R4). endpoint-list and openapi-export come from the graph;
 * request-response-schemas / auth-requirements / error-responses are ai.enrich
 * placeholders (the DocEnricherService fills them, flagged aiGenerated).
 */
export function generateApiReferenceDocument(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  _version: number,
  ctx: DocContext,
): GeneratedDocument {
  const endpoints = extractEndpoints(nodes, edges);

  const sections: DocSection[] = [
    endpointTable(endpoints),
    aiPlaceholder('request-response-schemas', 'Request / Response Schemas'),
    aiPlaceholder('auth-requirements', 'Auth Requirements'),
    aiPlaceholder('error-responses', 'Error Responses'),
    openApiExport(ctx.title, ctx.templateVersion, endpoints),
  ];

  return buildGeneratedDocument(DocType.API_REFERENCE, ctx, sections);
}

export class ApiReferenceContentGenerator implements IDocContentGenerator {
  readonly docType = DocType.API_REFERENCE;

  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument {
    return generateApiReferenceDocument(nodes, edges, version, ctx);
  }
}
