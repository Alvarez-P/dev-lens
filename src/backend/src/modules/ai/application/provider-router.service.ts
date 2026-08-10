import { Inject, Injectable, Logger } from '@nestjs/common';

import { AIProvider } from '../domain/ai-provider.interface';
import { CapabilityRegistry } from '../domain/capability-registry.interface';
import { BaseAIError, ProviderUnavailableError } from '../domain/ai-errors';
import { AIRequest } from '../domain/ai-request.vo';
import { AI_PROVIDER_REGISTRY, CAPABILITY_REGISTRY } from '../ai.tokens';

/** Retries on the same provider before falling back (ai-provider-abstraction R4). */
const MAX_ATTEMPTS_PER_PROVIDER = 2;

/**
 * Selects the best provider for a capability and executes requests with
 * retry-then-fallback (ai-provider-abstraction R2/R4, RFC-010 §6.4):
 *
 * Selection: providers whose `supportedModels` satisfy the capability's
 * `requiredCapabilities`, then healthy (healthCheck), then lowest
 * `estimateCost`. Throws `ProviderUnavailableError` when no provider matches.
 *
 * Fallback: a retriable failure (timeout, 429, 503) is retried ONCE on the
 * same provider, then the request falls through to the next provider sorted
 * by cost ascending. Authentication errors (401/403) fail immediately without
 * fallback.
 */
@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);

  constructor(
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providers: ReadonlyMap<string, AIProvider>,
    @Inject(CAPABILITY_REGISTRY)
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {}

  /**
   * Pick the single best provider for a capability. Throws
   * `ProviderUnavailableError` when no provider satisfies the capability
   * requirements AND passes the health check.
   */
  async selectProvider(capabilityId: string): Promise<AIProvider> {
    const candidates = await this.selectCandidates(capabilityId);

    return candidates[0];
  }

  /**
   * Execute `operation` (e.g. `provider.complete`) with retry-then-fallback:
   * each provider in the cost-ascending chain is attempted up to
   * `MAX_ATTEMPTS_PER_PROVIDER` times; only retriable errors continue the
   * chain, non-retriable errors (authentication) propagate immediately.
   */
  async executeWithFallback<T>(
    capabilityId: string,
    request: AIRequest,
    operation: (provider: AIProvider) => Promise<T>,
  ): Promise<T> {
    const chain = await this.selectCandidates(capabilityId);

    for (const provider of chain) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
        try {
          return await operation(provider);
        } catch (error) {
          if (!this.isRetriable(error)) {
            throw error;
          }

          if (attempt < MAX_ATTEMPTS_PER_PROVIDER) {
            this.logger.warn(`Provider "${provider.id}" attempt ${attempt} failed — retrying once`);
          }
        }
      }

      this.logger.warn(`Provider "${provider.id}" failed — falling back to next provider`);
    }

    throw new ProviderUnavailableError(
      capabilityId,
      '',
      `All AI providers failed for capability "${capabilityId}"`,
    );
  }

  /**
   * Capability-matched, healthy providers sorted by cost ascending. Throws
   * `ProviderUnavailableError` when the capability is unavailable or no
   * provider satisfies it.
   */
  private async selectCandidates(capabilityId: string): Promise<AIProvider[]> {
    const capability = this.capabilityRegistry.get(capabilityId);

    if (!this.capabilityRegistry.isAvailable(capabilityId)) {
      throw new ProviderUnavailableError(
        capabilityId,
        '',
        `AI capability "${capabilityId}" is not available`,
      );
    }

    const required = capability.requiredCapabilities ?? [];

    const healthy: AIProvider[] = [];

    for (const provider of this.providers.values()) {
      if (!this.supportsCapability(provider, required)) {
        continue;
      }

      if (await provider.healthCheck()) {
        healthy.push(provider);
      }
    }

    if (healthy.length === 0) {
      throw new ProviderUnavailableError(
        capabilityId,
        '',
        `No available AI provider for capability "${capabilityId}"`,
      );
    }

    return healthy.sort((a, b) => this.costOf(a, capabilityId) - this.costOf(b, capabilityId));
  }

  /** A provider satisfies the capability when every required tag is in supportedModels. */
  private supportsCapability(provider: AIProvider, required: readonly string[]): boolean {
    return required.every((requirement) => provider.supportedModels.includes(requirement));
  }

  /**
   * Cost is compared on an empty request — selection happens before the
   * request is built. Providers keep `estimateCost` request-insensitive for
   * routing purposes (mock returns a constant; the OpenAI/Ollama heuristics
   * are proportional, so the relative order is stable).
   */
  private costOf(provider: AIProvider, capabilityId: string): number {
    return provider.estimateCost({ messages: [], model: capabilityId });
  }

  /** Retriable per RFC-009 §12.1: timeout/429/503. 401/403 fail immediately. */
  private isRetriable(error: unknown): boolean {
    if (error instanceof BaseAIError) {
      return error.retriable;
    }

    // Unknown errors are not retried — surface them to the caller.
    return false;
  }
}
