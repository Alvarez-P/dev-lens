/**
 * Minimum capability shape the registry depends on.
 *
 * PR1 ships only the registry-facing contract. The full capability entity
 * (`contextStrategy`, `promptTemplate`, `outputFormat`, `validationRules`)
 * lands in PR2 (`domain/ai-capability.ts`) and is structurally compatible —
 * TypeScript accepts a richer object wherever this minimal type is expected.
 */
export interface AICapability {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
}

/**
 * Contract for the capability store. Registration and lookup semantics are
 * specified in the ai-capability-framework spec and implemented by the
 * in-memory `CapabilityRegistryService` (PR8):
 * - `register` rejects duplicate ids (`DuplicateCapabilityError`)
 * - `get` throws `CapabilityNotFoundError` for unknown ids
 * - `list(enabledOnly?)` filters to enabled capabilities by default
 * - `isAvailable` returns false for disabled capabilities
 */
export interface CapabilityRegistry {
  register(capability: AICapability): void;

  get(capabilityId: string): AICapability;

  list(enabledOnly?: boolean): AICapability[];

  isAvailable(capabilityId: string): boolean;
}
