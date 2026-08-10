import { Observable } from 'rxjs';
import {
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
  AIRequest,
  AIResponse,
} from './ai-request.vo';

/**
 * Single contract every AI provider adapter implements.
 *
 * Providers translate to their native API internally — no provider SDK
 * usage is allowed outside infrastructure adapters. Errors MUST be wrapped
 * as typed `BaseAIError` subtypes (REQ-AP-001).
 */
export interface AIProvider {
  /** Stable provider id used by the registry and router, e.g. 'openai'. */
  id: string;

  /** Human-readable provider name, e.g. 'OpenAI'. */
  name: string;

  /** Model ids this provider can serve; the router matches capability requirements against it. */
  supportedModels: string[];

  /** Send a prompt and receive the full response. */
  complete(req: AIRequest): Promise<AIResponse>;

  /** Send a prompt and receive a token stream (MVP deferred stub). */
  streamComplete(req: AIRequest): Observable<AIChunk>;

  /** Verify provider connectivity. */
  healthCheck(): Promise<boolean>;

  /** Pre-flight token cost estimate. */
  estimateCost(req: AIRequest): number;

  /** Batch enrichment for pipeline use. */
  enrich(req: AIEnrichmentRequest): Promise<AIEnrichmentResponse>;
}
