import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { generateModuleDocsDocument } from '@/modules/documentation/application/content-generators/module-docs.generator';
import { buildGraphFixture, buildEmptyGraphFixture } from './graph.fixture';

/**
 * Task 5.2 (PR4) — module-docs content generator (built-in v1 template).
 * public-api / dependencies / domain-model / events come from the graph;
 * module-purpose and db-tables are ai.enrich placeholders. Conditions
 * `has_dependencies` / `has_events` (template R4) gate the respective sections.
 */
const ctx = {
  repositoryId: 'repo-42',
  commitSha: 'abc123',
  templateVersion: '1',
  title: 'Module Documentation',
};

describe('module-docs content generator (5.2)', () => {
  it('should build a module documentation with template-ordered sections', () => {
    const fixture = buildGraphFixture();

    const doc = generateModuleDocsDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    expect(doc.docType).toBe(DocType.MODULE_DOCS);
    expect(doc.sections.map((s) => s.id)).toEqual([
      'module-purpose',
      'public-api',
      'dependencies',
      'domain-model',
      'events',
      'db-tables',
    ]);
  });

  it('should render the public API as a table of exported symbols with their module', () => {
    const fixture = buildGraphFixture();

    const doc = generateModuleDocsDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'public-api')!;
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { columns: string[]; rows: Array<Record<string, unknown>> };
    expect(content.columns).toEqual(expect.arrayContaining(['Module', 'Name']));
    expect(content.rows).toContainEqual(
      expect.objectContaining({ Module: 'users', Name: 'UsersController' }),
    );
    expect(content.rows).toContainEqual(expect.objectContaining({ Name: 'User' }));
  });

  it('should render the domain model as a mermaid class diagram', () => {
    const fixture = buildGraphFixture();

    const doc = generateModuleDocsDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'domain-model')!;
    expect(section.format).toBe(SectionFormat.MERMAID_CLASS_DIAGRAM);
    const content = section.content as { entities: Array<{ name: string }> };
    expect(content.entities.map((e) => e.name)).toEqual(expect.arrayContaining(['User', 'Order']));
  });

  it('should include the events section when the graph has domain events', () => {
    const fixture = buildGraphFixture();

    const doc = generateModuleDocsDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'events')!;
    expect(section).toBeDefined();
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { rows: Array<Record<string, unknown>> };
    expect(content.rows.map((row) => row.Event)).toContain('UserCreatedEvent');
  });

  it('should exclude conditional sections on an event-less, dependency-less graph (template R4)', () => {
    const fixture = buildEmptyGraphFixture();

    const doc = generateModuleDocsDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    expect(doc.sections.find((s) => s.id === 'events')).toBeUndefined();
    expect(doc.sections.find((s) => s.id === 'dependencies')).toBeUndefined();
    // Non-conditional graph sections remain.
    expect(doc.sections.find((s) => s.id === 'public-api')).toBeDefined();
    expect(doc.sections.find((s) => s.id === 'domain-model')).toBeDefined();
  });

  it('should emit module-purpose and db-tables as ai.enrich placeholders', () => {
    const fixture = buildGraphFixture();

    const doc = generateModuleDocsDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    for (const id of ['module-purpose', 'db-tables']) {
      const section = doc.sections.find((s) => s.id === id)!;
      expect(section.aiGenerated).toBe(false);
      expect(section.format).toBe(SectionFormat.MARKDOWN);
    }
  });
});
