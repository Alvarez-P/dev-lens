import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { generateReadmeDocument } from '@/modules/documentation/application/content-generators/readme.generator';
import { buildGraphFixture, buildEmptyGraphFixture } from './graph.fixture';

/**
 * Task 5.2 (PR4) — README content generator (template R2/R4 over the built-in
 * readme v1 template). Pure function over the fixture graph: project-overview
 * + getting-started are ai.enrich placeholders (filled by DocEnricherService),
 * architecture-diagram / module-index / tech-stack come from the graph.
 */
describe('readme content generator (5.2)', () => {
  it('should build a README GeneratedDocument from the fixture graph', () => {
    const fixture = buildGraphFixture();
    const ctx = {
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      templateVersion: '1',
      title: 'README',
    };

    const doc = generateReadmeDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    expect(doc.docType).toBe(DocType.README);
    expect(doc.repositoryId).toBe('repo-42');
    expect(doc.commitSha).toBe('abc123');
    expect(doc.templateVersion).toBe('1');
    expect(doc.title).toBe('README');
    expect(doc.sections.map((section) => section.id)).toEqual([
      'project-overview',
      'architecture-diagram',
      'module-index',
      'tech-stack',
      'getting-started',
    ]);
  });

  it('should render the architecture diagram as a mermaid class diagram from entities', () => {
    const fixture = buildGraphFixture();

    const doc = generateReadmeDocument(fixture.nodes, fixture.edges, fixture.version, {
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      templateVersion: '1',
      title: 'README',
    });

    const section = doc.sections.find((s) => s.id === 'architecture-diagram')!;
    expect(section.title).toBe('Architecture Diagram');
    expect(section.format).toBe(SectionFormat.MERMAID_CLASS_DIAGRAM);
    const content = section.content as { entities: Array<{ name: string }> };
    expect(content.entities.map((entity) => entity.name)).toEqual(
      expect.arrayContaining(['User', 'Order']),
    );
  });

  it('should render the module index as a table of modules', () => {
    const fixture = buildGraphFixture();

    const doc = generateReadmeDocument(fixture.nodes, fixture.edges, fixture.version, {
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      templateVersion: '1',
      title: 'README',
    });

    const section = doc.sections.find((s) => s.id === 'module-index')!;
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { columns: string[]; rows: Array<Record<string, unknown>> };
    expect(content.columns).toEqual(expect.arrayContaining(['Module']));
    expect(content.rows.map((row) => row.Module)).toEqual(
      expect.arrayContaining(['users', 'orders']),
    );
  });

  it('should render the tech stack as a list of external dependencies', () => {
    const fixture = buildGraphFixture();

    const doc = generateReadmeDocument(fixture.nodes, fixture.edges, fixture.version, {
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      templateVersion: '1',
      title: 'README',
    });

    const section = doc.sections.find((s) => s.id === 'tech-stack')!;
    expect(section.format).toBe(SectionFormat.LIST);
    const content = section.content as { items: unknown[] };
    expect(content.items).toEqual(expect.arrayContaining(['express', 'typeorm']));
  });

  it('should emit ai.enrich sections as empty markdown placeholders awaiting enrichment', () => {
    const fixture = buildGraphFixture();

    const doc = generateReadmeDocument(fixture.nodes, fixture.edges, fixture.version, {
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      templateVersion: '1',
      title: 'README',
    });

    for (const id of ['project-overview', 'getting-started']) {
      const section = doc.sections.find((s) => s.id === id)!;
      expect(section.format).toBe(SectionFormat.MARKDOWN);
      expect((section.content as { markdown: string }).markdown).toBe('');
      expect(section.aiGenerated).toBe(false);
    }
  });

  it('should produce an empty README skeleton on an empty graph', () => {
    const fixture = buildEmptyGraphFixture();

    const doc = generateReadmeDocument(fixture.nodes, fixture.edges, fixture.version, {
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      templateVersion: '1',
      title: 'README',
    });

    expect(doc.sections).toHaveLength(5);
    const moduleIndex = doc.sections.find((s) => s.id === 'module-index')!;
    expect((moduleIndex.content as { rows: unknown[] }).rows).toEqual([]);
  });
});
