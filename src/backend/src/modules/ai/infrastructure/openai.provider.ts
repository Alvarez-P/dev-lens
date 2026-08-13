import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { Observable } from 'rxjs';

import { AIProvider } from '../domain/ai-provider.interface';
import {
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
  AIRequest,
  AIResponse,
} from '../domain/ai-request.vo';
import {
  AIAuthenticationError,
  AIDidNotMeetSchemaError,
  AIInvalidResponseError,
  AIRateLimitError,
  BaseAIError,
  ProviderUnavailableError,
} from '../domain/ai-errors';
import { AIProviderConfig } from '@/config/configuration';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MODEL = 'gpt-4o';
const TOKENS_PER_4_CHARS = 0.25;

/**
 * OpenAI provider adapter — the only place the `openai` SDK is used
 * (REQ-AP-003). Adapts AIRequest → chat.completions.create and wraps
 * provider-native errors as typed AIError subtypes. Constructed from the
 * PR4 `ai.providers.openai` config section (REQ-AP-003 configuration-driven
 * setup); the API key is resolved by the module factory, never read here.
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedModels: string[];

  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly model: string;
  private readonly client: OpenAI | null;

  constructor(
    config: AIProviderConfig | undefined,
    apiKey: string | undefined,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    providerId = 'openai',
    providerName = 'OpenAI',
  ) {
    this.id = providerId;
    this.name = providerName;
    this.model = config?.defaultModel ?? DEFAULT_MODEL;
    this.supportedModels = [this.model];

    if (!apiKey) {
      this.logger.warn(
        `OpenAI API key missing — healthCheck() will return false, enrichment falls back`,
      );
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey,
        baseURL: config?.baseUrl,
        timeout: timeoutMs,
      });
    }
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const client = this.requireClient();

    try {
      const completion = await client.chat.completions.create({
        model: req.model ?? this.model,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        response_format: req.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
      });

      const choice = completion.choices[0];

      return {
        content: choice?.message?.content ?? '',
        model: completion.model,
        tokensUsed: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
        },
        finishReason: choice?.finish_reason ?? 'stop',
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Stream tokens from chat.completions with `stream: true`. Emits
   * `{ type: 'token' }` chunks per delta, then a final `{ type: 'done' }`
   * chunk carrying usage (via `include_usage`) and the served model
   * (ai-streaming R2 chunk contract). Provider failures surface as typed
   * BaseAIError subtypes through `error`; unsubscribing aborts the
   * in-flight request (ai-streaming R4 cancellation).
   */
  streamComplete(req: AIRequest): Observable<AIChunk> {
    return new Observable<AIChunk>((subscriber) => {
      const client = this.client;

      if (!client) {
        subscriber.error(
          new ProviderUnavailableError(this.model, this.model, 'OpenAI client not configured'),
        );
        return;
      }

      const abortController = new AbortController();

      void (async () => {
        try {
          const stream = await client.chat.completions.create(
            {
              model: req.model ?? this.model,
              messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
              max_tokens: req.maxTokens,
              temperature: req.temperature,
              response_format:
                req.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
              stream: true,
              stream_options: { include_usage: true },
            },
            { signal: abortController.signal },
          );

          let tokens = 0;

          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;

            if (delta) {
              subscriber.next({ type: 'token', content: delta });
            }

            if (chunk.usage) {
              tokens = chunk.usage.total_tokens ?? tokens;
            }
          }

          subscriber.next({ type: 'done', content: '', tokens, model: this.model });
          subscriber.complete();
        } catch (error) {
          subscriber.error(this.mapError(error));
        }
      })();

      return () => abortController.abort();
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      this.logger.warn(`OpenAI health check failed: ${this.errorMessage(error)}`);
      return false;
    }
  }

  estimateCost(req: AIRequest): number {
    const chars = req.messages.reduce((sum, m) => sum + m.content.length, 0);

    return Math.ceil(chars * TOKENS_PER_4_CHARS);
  }

  async enrich(req: AIEnrichmentRequest): Promise<AIEnrichmentResponse> {
    const response = await this.complete({ ...req, responseFormat: 'json_object' });

    return this.parseEnrichmentResponse(response.content);
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new ProviderUnavailableError(this.model, this.model, 'OpenAI client not configured');
    }

    return this.client;
  }

  private parseEnrichmentResponse(content: string): AIEnrichmentResponse {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AIInvalidResponseError(
        'openai',
        this.model,
        'Malformed JSON in enrichment response',
      );
    }

    if (!this.isEnrichmentResponse(parsed)) {
      throw new AIDidNotMeetSchemaError(
        'openai',
        this.model,
        'Enrichment response missing required fields (framework, architecture, confidence, classes)',
      );
    }

    return parsed;
  }

  private isEnrichmentResponse(value: unknown): value is AIEnrichmentResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      typeof candidate.framework === 'string' &&
      typeof candidate.architecture === 'string' &&
      typeof candidate.confidence === 'number' &&
      Array.isArray(candidate.classes)
    );
  }

  /**
   * Provider-native failure → typed AIError subtype. 429 is retriable
   * (rate limit); 401/403 fail immediately without fallback; everything
   * else (5xx, timeout, network) is a retriable unavailability.
   */
  private mapError(error: unknown): BaseAIError {
    const status = (error as { status?: number }).status;
    const message = this.errorMessage(error);

    if (status === 429) {
      return new AIRateLimitError('openai', this.model, message);
    }

    if (status === 401 || status === 403) {
      return new AIAuthenticationError('openai', this.model, message);
    }

    return new ProviderUnavailableError('openai', this.model, message);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
