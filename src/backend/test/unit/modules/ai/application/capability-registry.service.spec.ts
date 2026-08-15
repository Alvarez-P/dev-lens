import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { CapabilityRegistryService } from '@/modules/ai/application/capability-registry.service';
import { AICapability } from '@/modules/ai/domain/ai-capability';
import { createCapability } from '@/modules/ai/domain/ai-capability';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';
import { createPromptTemplate } from '@/modules/ai/domain/prompt-template';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';
import { CapabilityNotFoundError, DuplicateCapabilityError } from '@/modules/ai/domain/ai-errors';

/** Full capability definition (spec R1) built through the real entity factory. */
function makeCapability(
  overrides: Partial<Parameters<typeof createCapability>[0]> = {},
): AICapability {
  return createCapability({
    id: 'explain-module',
    name: 'Explain Module',
    description: 'Summarize what a module does, its dependencies, and its role',
    version: 1,
    enabled: true,
    contextStrategy: createContextStrategy({
      targetNodeType: NodeType.MODULE,
      relationshipDepth: 1,
      includeDependents: true,
      includeDependencies: true,
      includeApiSurface: true,
      includeEventSurface: false,
      includeDomainContext: false,
    }),
    promptTemplate: createPromptTemplate({
      systemInstruction: 'You are a DevLens architect.',
      contextPlaceholder: '{{context}}',
      userQueryWrapper: 'Question: {query}',
      capabilityInstructions: 'Explain the module in the context.',
    }),
    outputFormat: createOutputFormat({ type: 'markdown' }),
    validationRules: [],
    ...overrides,
  });
}

describe('CapabilityRegistryService (spec R2)', () => {
  it('should register and retrieve a capability by id with all fields populated', () => {
    const registry = new CapabilityRegistryService();
    const capability = makeCapability();

    registry.register(capability);

    const retrieved = registry.get('explain-module');
    expect(retrieved).toBe(capability);
    expect(retrieved.contextStrategy).not.toBeNull();
    expect(retrieved.promptTemplate).not.toBeNull();
    expect(retrieved.outputFormat.type).toBe('markdown');
  });

  it('should throw CapabilityNotFoundError for an unknown id', () => {
    const registry = new CapabilityRegistryService();

    expect(() => registry.get('never-registered')).toThrow(CapabilityNotFoundError);
    expect(() => registry.get('never-registered')).toThrow(/never-registered/);
  });

  it('should reject duplicate registration of the same id', () => {
    const registry = new CapabilityRegistryService();

    registry.register(makeCapability());

    expect(() => registry.register(makeCapability())).toThrow(DuplicateCapabilityError);
    expect(() => registry.register(makeCapability())).toThrow(/explain-module/);
  });

  it('should list only enabled capabilities by default', () => {
    const registry = new CapabilityRegistryService();

    registry.register(makeCapability({ id: 'a', name: 'A' }));
    registry.register(makeCapability({ id: 'b', name: 'B', enabled: false }));
    registry.register(makeCapability({ id: 'c', name: 'C' }));

    const enabled = registry.list();

    expect(enabled.map((capability) => capability.id)).toEqual(['a', 'c']);
  });

  it('should list all capabilities when enabledOnly is false', () => {
    const registry = new CapabilityRegistryService();

    registry.register(makeCapability({ id: 'a', name: 'A' }));
    registry.register(makeCapability({ id: 'b', name: 'B', enabled: false }));

    const all = registry.list(false);

    expect(all).toHaveLength(2);
    expect(all.some((capability) => !capability.enabled)).toBe(true);
  });

  it('should report availability for enabled capabilities only', () => {
    const registry = new CapabilityRegistryService();

    registry.register(makeCapability({ id: 'a', name: 'A' }));
    registry.register(makeCapability({ id: 'b', name: 'B', enabled: false }));

    expect(registry.isAvailable('a')).toBe(true);
    expect(registry.isAvailable('b')).toBe(false);
    expect(registry.isAvailable('never-registered')).toBe(false);
  });

  it('should exclude enrichment-only capabilities from list() and availability', () => {
    const registry = new CapabilityRegistryService();

    registry.register(
      makeCapability({
        id: 'classify-lifecycle',
        name: 'Classify Lifecycle',
        enrichmentOnly: true,
      }),
    );
    registry.register(makeCapability({ id: 'explain-module' }));

    // Orchestration-visible list never exposes enrichment-only capabilities,
    // regardless of the enabledOnly flag.
    expect(registry.list().map((capability) => capability.id)).toEqual(['explain-module']);
    expect(registry.list(false).map((capability) => capability.id)).toEqual(['explain-module']);

    // Routing treats enrichment-only as unavailable (rejects gracefully).
    expect(registry.isAvailable('classify-lifecycle')).toBe(false);
    expect(registry.isAvailable('explain-module')).toBe(true);

    // Registration is intact so the enrichment pipeline can still resolve it.
    expect(registry.get('classify-lifecycle').id).toBe('classify-lifecycle');
  });

  it('should preserve the registered order in list()', () => {
    const registry = new CapabilityRegistryService();

    registry.register(makeCapability({ id: 'first', name: 'First' }));
    registry.register(makeCapability({ id: 'second', name: 'Second', enabled: false }));
    registry.register(makeCapability({ id: 'third', name: 'Third' }));

    expect(registry.list().map((capability) => capability.id)).toEqual(['first', 'third']);
  });
});
