import { OpenApi3Renderer } from '@/modules/documentation/infrastructure/renderers/openapi.renderer';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

/**
 * Task 2.3 (PR1) — OpenApi3Renderer (documentation-formats R4). Produces a
 * valid OpenAPI 3.0 JSON document with info, paths (endpoints), and
 * components.schemas (DTO schemas). When DTO field metadata is absent the
 * renderer degrades to `{ type: "object", properties: {} }` instead of
 * failing.
 */
describe('OpenApi3Renderer — OpenAPI 3.0 document generation', () => {
  let renderer: OpenApi3Renderer;

  beforeEach(() => {
    renderer = new OpenApi3Renderer();
  });

  const makeDoc = (content: unknown): GeneratedDocument => ({
    docType: DocType.API_REFERENCE,
    templateVersion: '1',
    title: 'API Reference',
    repositoryId: 'repo-1',
    commitSha: 'abc123',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sections: [
      {
        id: 'openapi',
        title: 'OpenAPI',
        format: SectionFormat.JSON,
        content: { data: content },
      },
    ],
  });

  it('should generate a full OpenAPI 3.0 document with paths and schemas', () => {
    const data = {
      title: 'Users API',
      version: '1.0.0',
      endpoints: [
        {
          path: '/users',
          method: 'get',
          operationId: 'listUsers',
          responses: [{ status: 200, description: 'OK', schemaName: 'User' }],
        },
        {
          path: '/users/{id}',
          method: 'get',
          operationId: 'getUser',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: [{ status: 200, description: 'OK', schemaName: 'User' }],
        },
        {
          path: '/users',
          method: 'post',
          operationId: 'createUser',
          requestBody: { schemaName: 'CreateUser' },
          responses: [{ status: 201, description: 'Created', schemaName: 'User' }],
        },
        {
          path: '/users/{id}',
          method: 'put',
          operationId: 'updateUser',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { schemaName: 'UpdateUser' },
          responses: [{ status: 200, description: 'OK', schemaName: 'User' }],
        },
        {
          path: '/users/{id}',
          method: 'delete',
          operationId: 'deleteUser',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: [{ status: 204, description: 'No Content' }],
        },
      ],
      schemas: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'name', type: 'string' },
          ],
        },
        {
          name: 'CreateUser',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
        {
          name: 'UpdateUser',
          fields: [{ name: 'name', type: 'string' }],
        },
      ],
    };

    const artifact = renderer.render(makeDoc(data));
    const spec = JSON.parse(artifact.buffer.toString('utf8'));

    expect(artifact.format).toBe(DocFormat.OPENAPI);
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info).toEqual({ title: 'Users API', version: '1.0.0' });
    // 3 distinct paths; all 5 endpoint operations present.
    expect(Object.keys(spec.paths)).toEqual(['/users', '/users/{id}']);
    expect(Object.keys(spec.paths['/users'])).toEqual(['get', 'post']);
    expect(Object.keys(spec.paths['/users/{id}'])).toEqual(['get', 'put', 'delete']);
    expect(spec.components.schemas.User).toEqual({
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id'],
    });
    expect(spec.components.schemas.CreateUser.required).toEqual(['name']);
  });

  it('should degrade gracefully to type object with empty properties when DTO fields are absent', () => {
    const data = {
      title: 'Users API',
      version: '1.0.0',
      endpoints: [
        {
          path: '/users',
          method: 'get',
          operationId: 'listUsers',
          responses: [{ status: 200, description: 'OK', schemaName: 'User' }],
        },
      ],
      schemas: [{ name: 'User', fields: [] }],
    };

    const artifact = renderer.render(makeDoc(data));
    const spec = JSON.parse(artifact.buffer.toString('utf8'));

    expect(spec.openapi).toBe('3.0.0');
    expect(spec.components.schemas.User).toEqual({
      type: 'object',
      properties: {},
    });
  });
});
