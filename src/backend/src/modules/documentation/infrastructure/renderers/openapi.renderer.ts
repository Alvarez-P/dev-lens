import { DocFormat } from '../../domain/doc-format.enum';
import { GeneratedDocument } from '../../domain/doc-document';
import { IDocFormatRenderer, RenderedArtifact } from './renderer.interface';

export interface OpenApiEndpointParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: { type: string };
}

export interface OpenApiResponse {
  status: number;
  description: string;
  schemaName?: string;
}

export interface OpenApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  parameters?: OpenApiEndpointParameter[];
  requestBody?: { schemaName?: string; required?: boolean };
  responses?: OpenApiResponse[];
}

export interface OpenApiSchemaField {
  name: string;
  type: string;
  required?: boolean;
}

export interface OpenApiSchema {
  name: string;
  fields?: OpenApiSchemaField[];
}

export interface OpenApiSpecData {
  title: string;
  version: string;
  endpoints: OpenApiEndpoint[];
  schemas: OpenApiSchema[];
}

const DEFAULT_SCHEMA_TYPE = 'string';

/**
 * OpenApi3Renderer (documentation-formats R4) — document-level `openapi`
 * format. Reads endpoint + DTO data from the document's OpenAPI section
 * (content: { data: OpenApiSpecData }) and produces a valid OpenAPI 3.0 JSON
 * document. Absent DTO field metadata degrades to `type: object` with empty
 * properties rather than failing.
 */
export class OpenApi3Renderer implements IDocFormatRenderer {
  readonly format = DocFormat.OPENAPI;

  render(doc: GeneratedDocument): RenderedArtifact {
    const spec = buildOpenApiSpec(doc);
    return {
      format: DocFormat.OPENAPI,
      contentType: 'application/json',
      ext: 'openapi.json',
      buffer: Buffer.from(JSON.stringify(spec, null, 2), 'utf8'),
    };
  }
}

/** Extracts OpenApiSpecData from the first OpenAPI-shaped section. */
export function extractOpenApiData(doc: GeneratedDocument): OpenApiSpecData {
  for (const section of doc.sections) {
    const content = section.content as { data?: unknown };
    if (isOpenApiSpecData(content?.data)) {
      return content.data;
    }
  }
  return { title: doc.title, version: doc.templateVersion, endpoints: [], schemas: [] };
}

export function isOpenApiSpecData(value: unknown): value is OpenApiSpecData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as OpenApiSpecData;
  return Array.isArray(candidate.endpoints) && Array.isArray(candidate.schemas);
}

/** Builds the OpenAPI 3.0 document from endpoint + DTO data. */
export function buildOpenApiSpec(doc: GeneratedDocument): Record<string, unknown> {
  const data = extractOpenApiData(doc);

  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of data.endpoints) {
    const path = endpoint.path || '/';
    if (!paths[path]) {
      paths[path] = {};
    }
    paths[path][endpoint.method] = buildOperation(endpoint);
  }

  const schemas: Record<string, Record<string, unknown>> = {};
  for (const schema of data.schemas) {
    schemas[schema.name] = buildSchema(schema);
  }

  return {
    openapi: '3.0.0',
    info: {
      title: data.title || doc.title,
      version: data.version || doc.templateVersion,
    },
    paths,
    components: { schemas },
  };
}

function buildOperation(endpoint: OpenApiEndpoint): Record<string, unknown> {
  const operation: Record<string, unknown> = {};

  if (endpoint.operationId) {
    operation.operationId = endpoint.operationId;
  }
  if (endpoint.summary) {
    operation.summary = endpoint.summary;
  }

  if (endpoint.parameters && endpoint.parameters.length > 0) {
    operation.parameters = endpoint.parameters.map((parameter) => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required ?? false,
      schema: parameter.schema ?? { type: DEFAULT_SCHEMA_TYPE },
    }));
  }

  if (endpoint.requestBody) {
    const body: Record<string, unknown> = {};
    if (endpoint.requestBody.required !== undefined) {
      body.required = endpoint.requestBody.required;
    }
    if (endpoint.requestBody.schemaName) {
      body.content = {
        'application/json': {
          schema: { $ref: `#/components/schemas/${endpoint.requestBody.schemaName}` },
        },
      };
    }
    operation.requestBody = body;
  }

  const responses: Record<string, Record<string, unknown>> = {};
  const responseList = endpoint.responses ?? [];
  if (responseList.length === 0) {
    responses.default = { description: 'Default response' };
  } else {
    for (const response of responseList) {
      const entry: Record<string, unknown> = { description: response.description };
      if (response.schemaName) {
        entry.content = {
          'application/json': {
            schema: { $ref: `#/components/schemas/${response.schemaName}` },
          },
        };
      }
      responses[String(response.status)] = entry;
    }
  }
  operation.responses = responses;

  return operation;
}

function buildSchema(schema: OpenApiSchema): Record<string, unknown> {
  const fields = schema.fields ?? [];
  if (fields.length === 0) {
    // Graceful degradation: no DTO field metadata → type object, no properties.
    return { type: 'object', properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.name] = { type: field.type || DEFAULT_SCHEMA_TYPE };
    if (field.required) {
      required.push(field.name);
    }
  }

  const result: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) {
    result.required = required;
  }
  return result;
}
