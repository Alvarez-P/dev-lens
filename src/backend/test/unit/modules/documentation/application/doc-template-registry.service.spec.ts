import { Test, type TestingModule } from '@nestjs/testing';

import { DOC_TEMPLATE_REGISTRY } from '@/modules/documentation/documentation.tokens';
import {
  CONTROLLER_MERGE_DOC_TYPES,
  DocTemplateRegistryService,
  TemplateKind,
  mergeDocTemplates,
} from '@/modules/documentation/application/doc-template-registry.service';
import {
  DocTemplate,
  DocTemplateNotFoundError,
  DuplicateDocTemplateError,
} from '@/modules/documentation/domain/doc-template';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';

/**
 * Task 3.2 (PR2) — DocTemplateRegistry keyed by (type, version) with the
 * built-in fallback chain and the controller merge (documentation-template-system
 * R5). Org custom templates are deferred to Phase 2 — but the resolution order
 * (custom → built-in) is structural from day one. The service is provided under
 * the DOC_TEMPLATE_REGISTRY token.
 */
function makeTemplate(id: string, version: number, sectionIds: string[]): DocTemplate {
  return {
    id,
    name: id,
    version,
    sourcePath: `templates/${id}/v${version}/template.yml`,
    sections: sectionIds.map((sectionId) => ({
      id: sectionId,
      title: sectionId,
      source: 'graph.exports()',
      format: 'table',
    })),
  };
}

describe('DocTemplateRegistryService (3.2) — keyed (type, version) registry', () => {
  let registry: DocTemplateRegistryService;

  beforeEach(() => {
    registry = new DocTemplateRegistryService();
  });

  describe('registration and lookup', () => {
    it('stores templates keyed by (type, version) and retrieves the exact version', () => {
      registry.register(makeTemplate('readme', 1, ['overview']));
      registry.register(makeTemplate('readme', 2, ['overview', 'changelog']));

      const v1 = registry.get('readme', 1);

      expect(v1.version).toBe(1);
      expect(v1.sections).toHaveLength(1);
      expect(registry.get('readme', 2).sections).toHaveLength(2);
    });

    it('returns the latest version when none is requested (built-in fallback convenience)', () => {
      registry.register(makeTemplate('readme', 1, ['overview']));
      registry.register(makeTemplate('readme', 2, ['overview', 'changelog']));

      expect(registry.get('readme').version).toBe(2);
    });

    it('throws DocTemplateNotFoundError with the type for an unknown template', () => {
      expect(() => registry.get('onboarding-guide')).toThrow(DocTemplateNotFoundError);
      expect(() => registry.get('onboarding-guide')).toThrow(/onboarding-guide/);
    });

    it('throws DocTemplateNotFoundError when the exact version is not registered', () => {
      registry.register(makeTemplate('readme', 1, ['overview']));

      expect(() => registry.get('readme', 3)).toThrow(DocTemplateNotFoundError);
      expect(() => registry.get('readme', 3)).toThrow(/version 3/);
    });

    it('rejects a duplicate (type, version) registration', () => {
      registry.register(makeTemplate('readme', 1, ['overview']));

      expect(() => registry.register(makeTemplate('readme', 1, ['overview']))).toThrow(
        DuplicateDocTemplateError,
      );
    });

    it('allows the same type at different versions and different types at the same version', () => {
      registry.register(makeTemplate('readme', 1, ['a']));
      registry.register(makeTemplate('readme', 2, ['b']));
      registry.register(makeTemplate('api-reference', 1, ['c']));

      expect(registry.get('readme', 1).sections[0].id).toBe('a');
      expect(registry.get('readme', 2).sections[0].id).toBe('b');
      expect(registry.get('api-reference', 1).sections[0].id).toBe('c');
    });

    it('reports registration state via has() and list()', () => {
      registry.register(makeTemplate('readme', 1, ['overview']));
      registry.register(makeTemplate('api-reference', 1, ['endpoints']));

      expect(registry.has('readme')).toBe(true);
      expect(registry.has('readme', 1)).toBe(true);
      expect(registry.has('readme', 9)).toBe(false);
      expect(registry.has('unknown')).toBe(false);
      expect(registry.list()).toHaveLength(2);
    });
  });

  describe('resolution hierarchy (R5)', () => {
    it('falls back to the built-in template when no custom is registered', () => {
      registry.register(makeTemplate('readme', 1, ['overview']), TemplateKind.BUILT_IN);

      const resolved = registry.resolve('readme');

      expect(resolved?.version).toBe(1);
      expect(resolved?.sections[0].id).toBe('overview');
    });

    it('prefers an organization custom template over the built-in for the same type', () => {
      registry.register(makeTemplate('readme', 1, ['built-in-section']), TemplateKind.BUILT_IN);
      registry.register(makeTemplate('readme', 1, ['custom-section']), TemplateKind.CUSTOM);

      const resolved = registry.resolve('readme');

      expect(resolved?.sections[0].id).toBe('custom-section');
    });

    it('keeps built-ins available for other types when a custom exists elsewhere', () => {
      registry.register(makeTemplate('readme', 1, ['built-in']), TemplateKind.BUILT_IN);
      registry.register(makeTemplate('api-reference', 1, ['custom']), TemplateKind.CUSTOM);

      expect(registry.resolve('readme')?.sections[0].id).toBe('built-in');
      expect(registry.resolve('api-reference')?.sections[0].id).toBe('custom');
    });
  });

  describe('DI wiring (DOC_TEMPLATE_REGISTRY token)', () => {
    it('resolves the token to a DocTemplateRegistryService instance', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [{ provide: DOC_TEMPLATE_REGISTRY, useClass: DocTemplateRegistryService }],
      }).compile();

      const tokenRegistry = moduleRef.get(DOC_TEMPLATE_REGISTRY);

      expect(tokenRegistry).toBeInstanceOf(DocTemplateRegistryService);
      tokenRegistry.register(makeTemplate('readme', 1, ['overview']));
      expect(tokenRegistry.get('readme', 1).id).toBe('readme');
    });
  });
});

describe('mergeDocTemplates — controller merge (R5)', () => {
  it('merges sections from multiple templates in order', () => {
    const moduleDocs = makeTemplate('module-docs', 1, ['purpose', 'public-api']);
    const apiReference = makeTemplate('api-reference', 1, ['endpoints', 'schemas']);

    const merged = mergeDocTemplates([moduleDocs, apiReference]);

    expect(merged.sections.map((s) => s.id)).toEqual([
      'purpose',
      'public-api',
      'endpoints',
      'schemas',
    ]);
    // The merged template keeps the identity of the first template.
    expect(merged.id).toBe('module-docs');
    expect(merged.version).toBe(1);
  });

  it('de-duplicates sections with the same id, first occurrence wins', () => {
    const first = makeTemplate('module-docs', 1, ['overview', 'shared']);
    const second = makeTemplate('api-reference', 1, ['overview', 'endpoints']);

    const merged = mergeDocTemplates([first, second]);

    expect(merged.sections.map((s) => s.id)).toEqual(['overview', 'shared', 'endpoints']);
  });

  it('is a no-op for a single template', () => {
    const template = makeTemplate('readme', 1, ['overview', 'architecture']);

    const merged = mergeDocTemplates([template]);

    expect(merged.sections).toEqual(template.sections);
    expect(merged.id).toBe('readme');
  });

  it('throws when given an empty template list', () => {
    expect(() => mergeDocTemplates([])).toThrow(/empty/);
  });

  it('exposes the controller module merge pair (module-docs + api-reference)', () => {
    expect(CONTROLLER_MERGE_DOC_TYPES).toEqual([DocType.MODULE_DOCS, DocType.API_REFERENCE]);
  });

  it('merges the controller template pair through the registry', () => {
    const registry = new DocTemplateRegistryService();
    registry.register(makeTemplate('module-docs', 1, ['purpose', 'public-api']));
    registry.register(makeTemplate('api-reference', 1, ['endpoints', 'schemas']));

    const merged = registry.merge([...CONTROLLER_MERGE_DOC_TYPES]);

    expect(merged.sections.map((s) => s.id)).toEqual([
      'purpose',
      'public-api',
      'endpoints',
      'schemas',
    ]);
  });
});
