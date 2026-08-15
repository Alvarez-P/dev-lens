import type { AICapability } from './ai-capability';

/**
 * Re-exported for backward compatibility with PR1 consumers; the full
 * capability entity (with `contextStrategy`, `promptTemplate`, `outputFormat`
 * and `validationRules`) now lives in `domain/ai-capability.ts` (PR2).
 */
export type { AICapability } from './ai-capability';

/**
 * Contract for the capability store. Registration and lookup semantics are
 * specified in the ai-capability-framework spec and implemented by the
 * in-memory `CapabilityRegistryService` (PR8):
 * - `register` rejects duplicate ids (`DuplicateCapabilityError`)
 * - `get` throws `CapabilityNotFoundError` for unknown ids
 * - `list(enabledOnly?)` filters to enabled capabilities by default and never
 *   returns enrichment-only capabilities (not orchestration-visible)
 * - `isAvailable` returns false for disabled or enrichment-only capabilities
 */
export interface CapabilityRegistry {
  register(capability: AICapability): void;

  get(capabilityId: string): AICapability;

  list(enabledOnly?: boolean): AICapability[];

  isAvailable(capabilityId: string): boolean;
}
