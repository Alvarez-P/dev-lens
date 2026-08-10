/** BullMQ queue names and DI tokens for the AI module. */

export const AI_ENRICHMENT_QUEUE = 'ai-enrichment';
export const AI_ENRICHMENT_DLQ = 'ai-enrichment-dlq';

/** Token-injected registry of AIProvider adapters, keyed by provider name. */
export const AI_PROVIDER_REGISTRY = 'AI_PROVIDER_REGISTRY';

/** Token-injected CapabilityRegistry implementation (PR8). */
export const CAPABILITY_REGISTRY = 'CAPABILITY_REGISTRY';

/**
 * Token-injected AIEventDispatcher (PR12). Optional until the module wiring
 * (PR14) registers AIObserver; without it AIService silently drops events.
 */
export const AI_OBSERVER = 'AI_OBSERVER';
