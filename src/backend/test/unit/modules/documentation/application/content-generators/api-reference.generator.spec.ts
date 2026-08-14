import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { generateApiReferenceDocument } from '@/modules/documentation/application/content-generators/api-reference.generator';
import { buildGraphFixture, buildEmptyGraphFixture } from './graph.fixture';

/**
 * Task 5.2 (PR4) — api-reference content generator (built-in v1 template).
 * Endpoint list + openapi-export come from the graph; request-response-schemas
 * / auth-requirements / error-responses are ai.enrich placeholders. The
 * openapi-export JSON section must carry OpenApiSpecData (OpenAPI renderer R4).
 */
const ctx = {
  repositoryId: 'repo-42',
  commitSha: 'abc123',
  templateVersion: '1',
  title: 'API Reference',
};

describe('api-reference content generator (5.2)', () => {
  it('should build an API reference with template-ordered sections', () => {
    const fixture = buildGraphFixture();

    const doc = generateApiReferenceDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    expect(doc.docType).toBe(DocType.API_REFERENCE);
    expect(doc.sections.map((s) => s.id)).toEqual([
      'endpoint-list',
      'request-response-schemas',
      'auth-requirements',
      'error-responses',
      'openapi-export',
    ]);
  });

  it('should render the endpoint list as a table with method, path and controller', () => {
    const fixture = buildGraphFixture();

    const doc = generateApiReferenceDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'endpoint-list')!;
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { columns: string[]; rows: Array<Record<string, unknown>> };
    expect(content.columns).toEqual(expect.arrayContaining(['Method', 'Path']));
    expect(content.rows).toContainEqual(expect.objectContaining({ Method: 'GET', Path: '/users' }));
    expect(content.rows).toContainEqual(
      expect.objectContaining({ Method: 'POST', Path: '/users' }),
    );
  });

  it('should emit the openapi-export section as JSON carrying OpenApiSpecData', () => {
    const fixture = buildGraphFixture();

    const doc = generateApiReferenceDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'openapi-export')!;
    expect(section.format).toBe(SectionFormat.JSON);
    const content = section.content as {
      data: { title: string; version: string; endpoints: unknown[]; schemas: unknown[] };
    };
    expect(content.data).toEqual(
      expect.objectContaining({
        title: 'API Reference',
        endpoints: expect.arrayContaining([
          // OpenAPI 3.0 requires lowercase HTTP method keys.
          expect.objectContaining({ method: 'get', path: '/users' }),
          expect.objectContaining({ method: 'post', path: '/users' }),
        ]),
        schemas: expect.any(Array),
      }),
    );
    expect(Array.isArray(content.data.endpoints)).toBe(true);
    expect(Array.isArray(content.data.schemas)).toBe(true);
  });

  it('should emit ai.enrich sections as empty placeholders (markdown/list/table)', () => {
    const fixture = buildGraphFixture();

    const doc = generateApiReferenceDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const schemas = doc.sections.find((s) => s.id === 'request-response-schemas')!;
    expect(schemas.format).toBe(SectionFormat.MARKDOWN);
    expect((schemas.content as { markdown: string }).markdown).toBe('');

    const auth = doc.sections.find((s) => s.id === 'auth-requirements')!;
    expect(auth.format).toBe(SectionFormat.MARKDOWN);
    expect(auth.aiGenerated).toBe(false);
  });

  it('should produce empty endpoint data on an empty graph', () => {
    const fixture = buildEmptyGraphFixture();

    const doc = generateApiReferenceDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const list = doc.sections.find((s) => s.id === 'endpoint-list')!;
    expect((list.content as { rows: unknown[] }).rows).toEqual([]);
    const openapi = doc.sections.find((s) => s.id === 'openapi-export')!;
    const content = openapi.content as { data: { endpoints: unknown[] } };
    expect(content.data.endpoints).toEqual([]);
  });
});
