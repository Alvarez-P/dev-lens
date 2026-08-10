import { Injectable } from '@nestjs/common';

import { AICapability } from '../domain/ai-capability';
import { CapabilityRegistry } from '../domain/capability-registry.interface';
import { CapabilityNotFoundError, DuplicateCapabilityError } from '../domain/ai-errors';

/**
 * In-memory implementation of the CapabilityRegistry contract (spec R2,
 * RFC-010 §7.2). Registration and lookup semantics follow the
 * ai-capability-framework spec:
 * - `register` rejects duplicate ids (`DuplicateCapabilityError`)
 * - `get` throws `CapabilityNotFoundError` for unknown ids
 * - `list(enabledOnly?)` filters to enabled capabilities by default
 * - `isAvailable` returns false for disabled capabilities
 *
 * Module wiring (DI token, onModuleInit registration of the MVP
 * capability catalog) is owned by PR14.
 */
@Injectable()
export class CapabilityRegistryService implements CapabilityRegistry {
  private readonly capabilities = new Map<string, AICapability>();

  register(capability: AICapability): void {
    if (this.capabilities.has(capability.id)) {
      throw new DuplicateCapabilityError(capability.id);
    }

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
