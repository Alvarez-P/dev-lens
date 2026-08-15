import type { ContextStrategy } from './context-strategy';
import type { PromptTemplate } from './prompt-template';
import type { OutputFormat } from './output/output-format';
import type { ValidationRule } from './output/validation-rule';

/** Access tier (RFC-010 §5.1). Tier-based gating is deferred; MVP gates on `enabled` only. */
export type AICapabilityTier = 'free' | 'professional' | 'enterprise';

export const AI_CAPABILITY_TIERS: readonly AICapabilityTier[] = [
  'free',
  'professional',
  'enterprise',
];

/**
 * A discrete operation the AI can perform (spec R1, RFC-010 §5.1). Every
 * capability owns its context strategy, prompt template, output format and
 * validation rules, and is registered in the CapabilityRegistry.
 *
 * `version` is the capability version for evolution (RFC-010 §5.1) and also
 * selects the prompt template version `ai/capabilities/{id}/v{n}/` (RFC-010 §8.3).
 */
export interface AICapability {
  /** Unique slug, e.g. "explain-module". */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What it does. */
  description: string;
  /** Capability version (for evolution). */
  version: number;
  /** Access tier; defaults to "free" (spec R1). */
  tier: AICapabilityTier;
  /** Whether the capability is currently enabled (MVP gating). */
  enabled: boolean;
  /**
   * True when the capability is driven exclusively by the enrichment pipeline
   * and must NOT be discoverable/routable through the orchestration SSE path
   * (its templates live under `ai.capabilities/` and cannot be served by the
   * orchestration prompt builder). Defaults to false.
   */
  enrichmentOnly?: boolean;
  /**
   * Model/feature requirements the provider MUST satisfy (ai-provider-abstraction
   * R2), e.g. ["json_mode"]. Matched against `AIProvider.supportedModels`.
   * Optional on the interface for PR1/PR2 consumers; the factory defaults to
   * an empty list — no provider constraint.
   */
  requiredCapabilities?: readonly string[];
  /** What context to fetch. */
  contextStrategy: ContextStrategy;
  /** How to structure the prompt. */
  promptTemplate: PromptTemplate;
  /** Expected response structure. */
  outputFormat: OutputFormat;
  /** Post-generation validation. */
  validationRules: readonly ValidationRule[];
}

export interface AICapabilityInput {
  id: string;
  name: string;
  description: string;
  version: number;
  enabled: boolean;
  /**
   * Model/feature requirements for the provider (ai-provider-abstraction R2).
   * Defaults to an empty list — no provider constraint.
   */
  requiredCapabilities?: readonly string[];
  /** Enrichment-only capabilities are excluded from orchestration discovery. */
  enrichmentOnly?: boolean;
  contextStrategy: ContextStrategy;
  promptTemplate: PromptTemplate;
  outputFormat: OutputFormat;
  validationRules?: readonly ValidationRule[];
  /** Defaults to "free" (spec R1). */
  tier?: AICapabilityTier;
}

const CAPABILITY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Builds an AICapability, applying the spec-mandated `tier` default ("free")
 * and validating the definition invariants the registry depends on: a slug id,
 * non-empty name/description, and a positive version.
 */
export function createCapability(input: AICapabilityInput): AICapability {
  if (!CAPABILITY_ID_PATTERN.test(input.id)) {
    throw new Error(
      `AICapability id must be a lowercase slug (e.g. "explain-module"), got "${input.id}"`,
    );
  }

  if (input.name.trim().length === 0) {
    throw new Error('AICapability name must be a non-empty string');
  }

  if (input.description.trim().length === 0) {
    throw new Error('AICapability description must be a non-empty string');
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error(`AICapability version must be a positive integer, got ${input.version}`);
  }

  const tier = input.tier ?? 'free';

  if (!AI_CAPABILITY_TIERS.includes(tier)) {
    throw new Error(
      `AICapability tier must be one of ${AI_CAPABILITY_TIERS.join(', ')}, got "${tier}"`,
    );
  }

  return Object.freeze({
    id: input.id,
    name: input.name,
    description: input.description,
    version: input.version,
    tier,
    enabled: input.enabled,
    requiredCapabilities: Object.freeze([...(input.requiredCapabilities ?? [])]),
    enrichmentOnly: input.enrichmentOnly ?? false,
    contextStrategy: input.contextStrategy,
    promptTemplate: input.promptTemplate,
    outputFormat: input.outputFormat,
    validationRules: Object.freeze([...(input.validationRules ?? [])]),
  });
}
