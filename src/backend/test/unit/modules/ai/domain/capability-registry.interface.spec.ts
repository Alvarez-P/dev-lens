import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import {
  AICapability,
  CapabilityRegistry,
} from '@/modules/ai/domain/capability-registry.interface';
import { CapabilityNotFoundError } from '@/modules/ai/domain/ai-errors';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';
import { createPromptTemplate } from '@/modules/ai/domain/prompt-template';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';

/** Full capability definition (spec R1) shared by the contract tests. */
function makeCapability(overrides: Partial<AICapability> = {}): AICapability {
  return {
    id: 'explain-module',
    name: 'Explain Module',
    description: 'Summarize what a module does, its dependencies, and its role',
    version: 1,
    tier: 'free',
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
  };
}

describe('AICapability contract', () => {
  it('should carry id, name, version and enabled state', () => {
    const capability: AICapability = makeCapability();

    expect(capability.id).toBe('explain-module');
    expect(capability.name).toBe('Explain Module');
    expect(capability.version).toBe(1);
    expect(capability.enabled).toBe(true);
  });

  it('should represent a disabled capability', () => {
    const capability: AICapability = makeCapability({ enabled: false });

    expect(capability.enabled).toBe(false);
  });

  it('should carry the full definition with contextStrategy and promptTemplate populated', () => {
    // Spec R1 scenario: the returned capability has all required fields
    // populated and its contextStrategy and promptTemplate are non-null.
    const capability: AICapability = makeCapability();

    expect(capability.description.length).toBeGreaterThan(0);
    expect(capability.tier).toBe('free');
    expect(capability.contextStrategy.targetNodeType).toBe(NodeType.MODULE);
    expect(capability.promptTemplate.systemInstruction).toBe('You are a DevLens architect.');
    expect(capability.outputFormat.type).toBe('markdown');
    expect(capability.validationRules).toEqual([]);
  });
});

describe('CapabilityRegistry contract', () => {
  class InMemoryRegistry implements CapabilityRegistry {
    private readonly capabilities = new Map<string, AICapability>();

    register(capability: AICapability): void {
      this.capabilities.set(capability.id, capability);
    }

    get(capabilityId: string): AICapability {
      const capability = this.capabilities.get(capabilityId);

      if (!capability) {
        throw new CapabilityNotFoundError(capabilityId);
      }

      return capability;
    }

    list(enabledOnly = true): AICapability[] {
      const all = [...this.capabilities.values()];

      return enabledOnly ? all.filter((capability) => capability.enabled) : all;
    }

    isAvailable(capabilityId: string): boolean {
      return this.capabilities.get(capabilityId)?.enabled === true;
    }
  }

  it('should register and retrieve a capability by id', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();
    const capability: AICapability = makeCapability();

    registry.register(capability);

    expect(registry.get('explain-module')).toEqual(capability);
  });

  it('should list only enabled capabilities by default', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    registry.register(makeCapability({ id: 'a', name: 'A' }));
    registry.register(makeCapability({ id: 'b', name: 'B', enabled: false }));
    registry.register(makeCapability({ id: 'c', name: 'C' }));

    const enabled = registry.list();

    expect(enabled.map((capability) => capability.id)).toEqual(['a', 'c']);
  });

  it('should list all capabilities when enabledOnly is false', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    registry.register(makeCapability({ id: 'a', name: 'A' }));
    registry.register(makeCapability({ id: 'b', name: 'B', enabled: false }));

    const all = registry.list(false);

    expect(all).toHaveLength(2);
    expect(all.some((capability) => !capability.enabled)).toBe(true);
  });

  it('should report availability for enabled capabilities only', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    registry.register(makeCapability({ id: 'a', name: 'A' }));
    registry.register(makeCapability({ id: 'b', name: 'B', enabled: false }));

    expect(registry.isAvailable('a')).toBe(true);
    expect(registry.isAvailable('b')).toBe(false);
    expect(registry.isAvailable('never-registered')).toBe(false);
  });

  it('should throw CapabilityNotFoundError for unknown ids', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    expect(() => registry.get('missing-capability')).toThrow(CapabilityNotFoundError);
  });
});
