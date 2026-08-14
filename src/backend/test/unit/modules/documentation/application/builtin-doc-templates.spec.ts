import { DocTemplateLoaderService } from '@/modules/documentation/application/doc-template-loader.service';
import { DocTemplateRegistryService } from '@/modules/documentation/application/doc-template-registry.service';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';

/**
 * Task 3.3 (PR2) — the five built-in v1 templates shipped with the module
 * (documentation-template-system R6/R7). Loaded from the real repo tree via
 * the loader's default base dir (like real-template-files.spec.ts), registered
 * into the registry, and verified against the R7 section catalogs.
 *
 * R2 source expressions: graph.{exports,dependencies,entities,endpoints,events}()
 * or ai.enrich("id"). R3 formats: SectionFormat values.
 */
const SOURCE_PATTERN =
  /^((graph\.(exports|dependencies|entities|endpoints|events)\(.*\))|(ai\.enrich\(".*"\)))$/;
const SECTION_FORMATS = new Set(Object.values(SectionFormat));

/** R7 section catalogs, in template order. */
const EXPECTED_SECTIONS: Record<DocType, string[]> = {
  [DocType.README]: [
    'project-overview',
    'architecture-diagram',
    'module-index',
    'tech-stack',
    'getting-started',
  ],
  [DocType.ARCHITECTURE_GUIDE]: [
    'system-overview',
    'container-diagram',
    'component-diagram',
    'bounded-context-map',
    'event-catalog',
    'dependency-map',
  ],
  [DocType.API_REFERENCE]: [
    'endpoint-list',
    'request-response-schemas',
    'auth-requirements',
    'error-responses',
    'openapi-export',
  ],
  [DocType.MODULE_DOCS]: [
    'module-purpose',
    'public-api',
    'dependencies',
    'domain-model',
    'events',
    'db-tables',
  ],
  [DocType.ONBOARDING_GUIDE]: [
    'repo-structure',
    'key-modules',
    'architecture-overview',
    'dev-setup',
    'common-workflows',
    'glossary',
  ],
};

describe('Built-in v1 templates (3.3) — R7 catalog', () => {
  let loader: DocTemplateLoaderService;
  let registry: DocTemplateRegistryService;

  beforeEach(() => {
    loader = new DocTemplateLoaderService();
    registry = new DocTemplateRegistryService();
    for (const template of loader.loadAll()) {
      registry.register(template);
    }
  });

  it('loads all 5 built-in templates at v1 from the module templates tree (R6)', () => {
    expect(loader.baseDir).toMatch(/modules[/\\]documentation[/\\]templates$/);

    const all = loader.loadAll();
    const types = all.map((t) => t.id).sort();

    expect(types).toEqual([
      DocType.API_REFERENCE,
      DocType.ARCHITECTURE_GUIDE,
      DocType.MODULE_DOCS,
      DocType.ONBOARDING_GUIDE,
      DocType.README,
    ]);
    for (const template of all) {
      expect(template.version).toBe(1);
      expect(template.sourcePath).toMatch(/template\.yml$/);
    }
  });

  it('registers every built-in so the registry resolves it (R5 built-in fallback)', () => {
    for (const type of Object.values(DocType)) {
      const template = registry.get(type);
      expect(template.version).toBe(1);
    }
    expect(registry.has('unknown-type')).toBe(false);
  });

  it('each template contains exactly its R7 section catalog with valid sources and formats', () => {
    for (const type of Object.values(DocType)) {
      const template = registry.get(type);

      expect(template.sections.map((s) => s.id)).toEqual(EXPECTED_SECTIONS[type]);

      // Every section must carry a valid R2 source expression and R3 format
      // value; the expected table is all-true so any violation appears in the
      // diff with the offending section id.
      const validity = template.sections.map((s) => ({
        id: s.id,
        sourceValid: SOURCE_PATTERN.test(s.source),
        formatValid: SECTION_FORMATS.has(s.format as SectionFormat),
      }));
      expect(validity).toEqual(
        template.sections.map((s) => ({ id: s.id, sourceValid: true, formatValid: true })),
      );
    }
  });

  it('keeps section ids unique within every template (R1)', () => {
    const typesWithDuplicates = Object.values(DocType).filter((type) => {
      const ids = registry.get(type).sections.map((s) => s.id);
      return new Set(ids).size !== ids.length;
    });

    expect(typesWithDuplicates).toEqual([]);
  });

  describe('R7 scenarios', () => {
    it('README template contains the 5 required sections', () => {
      const readme = registry.get(DocType.README);

      expect(readme.sections.map((s) => s.title)).toEqual([
        'Project Overview',
        'Architecture Diagram',
        'Module Index',
        'Technology Stack',
        'Getting Started',
      ]);
    });

    it('architecture-guide gates the event catalog on has_events and renders it as a table', () => {
      const guide = registry.get(DocType.ARCHITECTURE_GUIDE);
      const eventCatalog = guide.sections.find((s) => s.id === 'event-catalog');

      expect(eventCatalog?.condition).toBe('has_events');
      expect(eventCatalog?.format).toBe(SectionFormat.TABLE);
      expect(eventCatalog?.source).toMatch(/^graph\.events/);
    });

    it('module-docs gates dependencies and events behind R4 conditions', () => {
      const moduleDocs = registry.get(DocType.MODULE_DOCS);

      expect(moduleDocs.sections.find((s) => s.id === 'dependencies')?.condition).toBe(
        'has_dependencies',
      );
      expect(moduleDocs.sections.find((s) => s.id === 'events')?.condition).toBe('has_events');
    });
  });
});
