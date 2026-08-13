import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { generateArchitectureGuideDocument } from '@/modules/documentation/application/content-generators/architecture-guide.generator';
import { buildGraphFixture, buildEmptyGraphFixture } from './graph.fixture';

/**
 * Task 5.2 (PR4) — architecture-guide content generator (built-in v1 template).
 * Covers the event-catalog conditional section (template R4 condition
 * `has_events`): the section must be excluded when the graph has no domain
 * events, and included with a table when it does.
 */
const ctx = {
  repositoryId: 'repo-42',
  commitSha: 'abc123',
  templateVersion: '1',
  title: 'Architecture Guide',
};

describe('architecture-guide content generator (5.2)', () => {
  it('should build an architecture guide with template-ordered sections', () => {
    const fixture = buildGraphFixture();

    const doc = generateArchitectureGuideDocument(
      fixture.nodes,
      fixture.edges,
      fixture.version,
      ctx,
    );

    expect(doc.docType).toBe(DocType.ARCHITECTURE_GUIDE);
    expect(doc.sections.map((s) => s.id)).toEqual([
      'system-overview',
      'container-diagram',
      'component-diagram',
      'bounded-context-map',
      'event-catalog',
      'dependency-map',
    ]);
  });

  it('should render container + dependency maps as mermaid flowcharts from module deps', () => {
    const fixture = buildGraphFixture();

    const doc = generateArchitectureGuideDocument(
      fixture.nodes,
      fixture.edges,
      fixture.version,
      ctx,
    );

    const container = doc.sections.find((s) => s.id === 'container-diagram')!;
    expect(container.format).toBe(SectionFormat.MERMAID_FLOWCHART);
    const content = container.content as {
      nodes: Array<{ id: string }>;
      edges: Array<{ from: string; to: string }>;
    };
    expect(content.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['users', 'orders']));
    expect(content.edges).toContainEqual({ from: 'users', to: 'orders' });

    const dependencyMap = doc.sections.find((s) => s.id === 'dependency-map')!;
    expect(dependencyMap.format).toBe(SectionFormat.MERMAID_FLOWCHART);
  });

  it('should render the bounded-context map as a table of modules', () => {
    const fixture = buildGraphFixture();

    const doc = generateArchitectureGuideDocument(
      fixture.nodes,
      fixture.edges,
      fixture.version,
      ctx,
    );

    const section = doc.sections.find((s) => s.id === 'bounded-context-map')!;
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { rows: Array<Record<string, unknown>> };
    expect(content.rows.map((row) => row.Module)).toEqual(
      expect.arrayContaining(['users', 'orders']),
    );
  });

  it('should include the event catalog when the graph has domain events (condition has_events)', () => {
    const fixture = buildGraphFixture();

    const doc = generateArchitectureGuideDocument(
      fixture.nodes,
      fixture.edges,
      fixture.version,
      ctx,
    );

    const section = doc.sections.find((s) => s.id === 'event-catalog')!;
    expect(section).toBeDefined();
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { rows: Array<Record<string, unknown>> };
    expect(content.rows.map((row) => row.Event)).toContain('UserCreatedEvent');
  });

  it('should exclude the event catalog when the graph has no events (template R4)', () => {
    const fixture = buildEmptyGraphFixture();

    const doc = generateArchitectureGuideDocument(
      fixture.nodes,
      fixture.edges,
      fixture.version,
      ctx,
    );

    const section = doc.sections.find((s) => s.id === 'event-catalog');
    expect(section).toBeUndefined();
    expect(doc.sections.map((s) => s.id)).not.toContain('event-catalog');
  });

  it('should emit the system-overview as an ai.enrich placeholder', () => {
    const fixture = buildGraphFixture();

    const doc = generateArchitectureGuideDocument(
      fixture.nodes,
      fixture.edges,
      fixture.version,
      ctx,
    );

    const section = doc.sections.find((s) => s.id === 'system-overview')!;
    expect(section.format).toBe(SectionFormat.MARKDOWN);
    expect((section.content as { markdown: string }).markdown).toBe('');
    expect(section.aiGenerated).toBe(false);
  });
});
