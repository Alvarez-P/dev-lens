/** BullMQ queue names and DI tokens for the AI module. */

export const AI_ENRICHMENT_QUEUE = 'ai-enrichment';
export const AI_ENRICHMENT_DLQ = 'ai-enrichment-dlq';

/** Token-injected registry of AIProvider adapters, keyed by provider name. */
export const AI_PROVIDER_REGISTRY = 'AI_PROVIDER_REGISTRY';

/** Token-injected CapabilityRegistry implementation (PR8). */
export const CAPABILITY_REGISTRY = 'CAPABILITY_REGISTRY';
