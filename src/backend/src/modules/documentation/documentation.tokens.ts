/** BullMQ queue names and DI tokens for the documentation module. */

export const DOCUMENTATION_QUEUE = 'documentation-generation';
export const DOCUMENTATION_DLQ = 'documentation-generation-dlq';

/**
 * Token-injected registry of IDocFormatRenderer adapters, keyed by
 * `DocFormat`. The FORMAT_RENDERER token is provided by a factory that assembles
 * the registered renderers into an array (NestJS has no `multi: true`, mirroring
 * AI_PROVIDER_REGISTRY), so a new renderer requires zero changes to existing
 * code (documentation-formats R1).
 */
export const FORMAT_RENDERER = 'FORMAT_RENDERER';

/**
 * Token-injected DocTemplateRegistry implementation (keyed by doc type +
 * template version). Filled at module initialization by the template loader
 * (documentation-template-system R5/R6).
 */
export const DOC_TEMPLATE_REGISTRY = 'DOC_TEMPLATE_REGISTRY';
