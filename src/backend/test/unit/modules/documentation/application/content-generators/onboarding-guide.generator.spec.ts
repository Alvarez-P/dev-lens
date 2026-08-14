import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { generateOnboardingGuideDocument } from '@/modules/documentation/application/content-generators/onboarding-guide.generator';
import { buildGraphFixture, buildEmptyGraphFixture } from './graph.fixture';

/**
 * Task 5.2 (PR4) — onboarding-guide content generator (built-in v1 template).
 * repo-structure / key-modules / architecture-overview come from the graph;
 * dev-setup / common-workflows / glossary are ai.enrich placeholders.
 */
const ctx = {
  repositoryId: 'repo-42',
  commitSha: 'abc123',
  templateVersion: '1',
  title: 'Onboarding Guide',
};

describe('onboarding-guide content generator (5.2)', () => {
  it('should build an onboarding guide with template-ordered sections', () => {
    const fixture = buildGraphFixture();

    const doc = generateOnboardingGuideDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    expect(doc.docType).toBe(DocType.ONBOARDING_GUIDE);
    expect(doc.sections.map((s) => s.id)).toEqual([
      'repo-structure',
      'key-modules',
      'architecture-overview',
      'dev-setup',
      'common-workflows',
      'glossary',
    ]);
  });

  it('should render the repo structure as a list of module labels', () => {
    const fixture = buildGraphFixture();

    const doc = generateOnboardingGuideDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'repo-structure')!;
    expect(section.format).toBe(SectionFormat.LIST);
    expect((section.content as { items: unknown[] }).items).toEqual(
      expect.arrayContaining(['users', 'orders']),
    );
  });

  it('should render the key modules as a table with FQNs', () => {
    const fixture = buildGraphFixture();

    const doc = generateOnboardingGuideDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'key-modules')!;
    expect(section.format).toBe(SectionFormat.TABLE);
    const content = section.content as { rows: Array<Record<string, unknown>> };
    expect(content.rows).toContainEqual(
      expect.objectContaining({ Module: 'users', FQN: 'acme:default:src/users' }),
    );
  });

  it('should render the architecture overview as a mermaid class diagram', () => {
    const fixture = buildGraphFixture();

    const doc = generateOnboardingGuideDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    const section = doc.sections.find((s) => s.id === 'architecture-overview')!;
    expect(section.format).toBe(SectionFormat.MERMAID_CLASS_DIAGRAM);
    const content = section.content as { entities: Array<{ name: string }> };
    expect(content.entities.map((e) => e.name)).toEqual(expect.arrayContaining(['User', 'Order']));
  });

  it('should emit dev-setup / common-workflows / glossary as ai.enrich placeholders', () => {
    const fixture = buildGraphFixture();

    const doc = generateOnboardingGuideDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    for (const id of ['dev-setup', 'common-workflows', 'glossary']) {
      const section = doc.sections.find((s) => s.id === id)!;
      expect(section.aiGenerated).toBe(false);
      expect(section.format).toBe(SectionFormat.MARKDOWN);
    }
  });

  it('should keep graph sections on an empty graph with empty content', () => {
    const fixture = buildEmptyGraphFixture();

    const doc = generateOnboardingGuideDocument(fixture.nodes, fixture.edges, fixture.version, ctx);

    expect(doc.sections).toHaveLength(6);
    expect(
      (doc.sections.find((s) => s.id === 'repo-structure')!.content as { items: unknown[] }).items,
    ).toEqual([]);
  });
});
