import {
  AICapability,
  CapabilityRegistry,
} from '@/modules/ai/domain/capability-registry.interface';
import { CapabilityNotFoundError } from '@/modules/ai/domain/ai-errors';

describe('AICapability contract', () => {
  it('should carry id, name, version and enabled state', () => {
    const capability: AICapability = {
      id: 'explain-module',
      name: 'Explain Module',
      version: 1,
      enabled: true,
    };

    expect(capability.id).toBe('explain-module');
    expect(capability.name).toBe('Explain Module');
    expect(capability.version).toBe(1);
    expect(capability.enabled).toBe(true);
  });

  it('should represent a disabled capability', () => {
    const capability: AICapability = {
      id: 'analyze-impact',
      name: 'Analyze Impact',
      version: 1,
      enabled: false,
    };

    expect(capability.enabled).toBe(false);
  });

  it('should accept a richer capability object (structural typing)', () => {
    // PR2's full AICapability entity carries contextStrategy, promptTemplate,
    // outputFormat and validationRules. A value with extra fields must satisfy
    // the minimal registry-facing contract once it is a variable, not a literal.
    const richCapability = {
      id: 'lifecycle-enrichment',
      name: 'Lifecycle Enrichment',
      version: 2,
      enabled: true,
      contextStrategy: { relationshipDepth: 1 },
      outputFormat: { type: 'json' },
    };

    const capability: AICapability = richCapability;

    expect(capability.id).toBe('lifecycle-enrichment');
    expect(capability.enabled).toBe(true);
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
    const capability: AICapability = {
      id: 'explain-module',
      name: 'Explain Module',
      version: 1,
      enabled: true,
    };

    registry.register(capability);

    expect(registry.get('explain-module')).toEqual(capability);
  });

  it('should list only enabled capabilities by default', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    registry.register({ id: 'a', name: 'A', version: 1, enabled: true });
    registry.register({ id: 'b', name: 'B', version: 1, enabled: false });
    registry.register({ id: 'c', name: 'C', version: 1, enabled: true });

    const enabled = registry.list();

    expect(enabled.map((capability) => capability.id)).toEqual(['a', 'c']);
  });

  it('should list all capabilities when enabledOnly is false', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    registry.register({ id: 'a', name: 'A', version: 1, enabled: true });
    registry.register({ id: 'b', name: 'B', version: 1, enabled: false });

    const all = registry.list(false);

    expect(all).toHaveLength(2);
    expect(all.some((capability) => !capability.enabled)).toBe(true);
  });

  it('should report availability for enabled capabilities only', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    registry.register({ id: 'a', name: 'A', version: 1, enabled: true });
    registry.register({ id: 'b', name: 'B', version: 1, enabled: false });

    expect(registry.isAvailable('a')).toBe(true);
    expect(registry.isAvailable('b')).toBe(false);
    expect(registry.isAvailable('never-registered')).toBe(false);
  });

  it('should throw CapabilityNotFoundError for unknown ids', () => {
    const registry: CapabilityRegistry = new InMemoryRegistry();

    expect(() => registry.get('missing-capability')).toThrow(CapabilityNotFoundError);
  });
});
