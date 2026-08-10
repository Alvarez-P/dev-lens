import { Injectable, Logger } from '@nestjs/common';
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
const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
const TOKENS_PER_4_CHARS = 0.25;

/**
 * Ollama provider adapter — zero-dependency `fetch` protocol (REQ-AP-003).
 * Uses POST /api/generate for completion + streaming and GET /api/tags for
 * health. Constructed from the PR4 `ai.providers.ollama` config section
 * (REQ-AP-003 configuration-driven setup); the base URL and default model
 * come from config with localhost defaults for local development.
 */
@Injectable()
export class OllamaProvider implements AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  readonly supportedModels: string[];

  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    config: AIProviderConfig | undefined,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    fetchFn: typeof fetch = fetch,
  ) {
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.model = config?.defaultModel ?? DEFAULT_MODEL;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
    this.supportedModels = [this.model];
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const data = await this.generate(req, false);

    return {
      content: typeof data.response === 'string' ? data.response : '',
      model: typeof data.model === 'string' ? data.model : this.model,
      tokensUsed: {
        input: this.toNumber(data.prompt_eval_count),
        output: this.toNumber(data.eval_count),
      },
      finishReason: data.done ? 'stop' : 'length',
    };
  }

  /**
   * Stream tokens from /api/generate with `stream: true` (NDJSON lines).
   * Emits `{ type: 'token' }` chunks per `response` delta, then a final
   * `{ type: 'done' }` chunk carrying usage (eval_count) and the served
   * model (ai-streaming R2 chunk contract). Provider failures surface as
   * typed BaseAIError subtypes through `error`; unsubscribing aborts the
   * in-flight request (ai-streaming R4 cancellation).
   */
  streamComplete(req: AIRequest): Observable<AIChunk> {
    return new Observable<AIChunk>((subscriber) => {
      const abortController = new AbortController();
      const signal = AbortSignal.any([abortController.signal, AbortSignal.timeout(this.timeoutMs)]);

      void (async () => {
        try {
          const response = await this.fetchFn(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: req.model ?? this.model,
              prompt: req.messages.map((m) => m.content).join('\n'),
              stream: true,
              options: {
                ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
                ...(req.maxTokens !== undefined ? { num_predict: req.maxTokens } : {}),
              },
            }),
            signal,
          });

          if (!response.ok) {
            throw this.mapHttpStatus(
              response.status,
              `Ollama /api/generate returned ${response.status}`,
            );
          }

          const reader = response.body?.getReader();

          if (!reader) {
            throw new ProviderUnavailableError('ollama', this.model, 'Ollama returned no body');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let tokens = 0;
          let result = await reader.read();

          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) {
                continue;
              }

              const chunk = JSON.parse(line) as Record<string, unknown>;
              const delta = chunk.response;

              if (typeof delta === 'string' && delta.length > 0) {
                subscriber.next({ type: 'token', content: delta });
              }

              if (chunk.done === true) {
                tokens = this.toNumber(chunk.eval_count);
              }
            }

            result = await reader.read();
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
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Ollama health check failed: ${this.errorMessage(error)}`);
      return false;
    }
  }

  estimateCost(req: AIRequest): number {
    const chars = req.messages.reduce((sum, m) => sum + m.content.length, 0);

    return Math.ceil(chars * TOKENS_PER_4_CHARS);
  }

  async enrich(req: AIEnrichmentRequest): Promise<AIEnrichmentResponse> {
    const data = await this.generate(req, true);
    const content = typeof data.response === 'string' ? data.response : '';

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AIInvalidResponseError(
        'ollama',
        this.model,
        'Malformed JSON in enrichment response',
      );
    }

    if (!this.isEnrichmentResponse(parsed)) {
      throw new AIDidNotMeetSchemaError(
        'ollama',
        this.model,
        'Enrichment response missing required fields (framework, architecture, confidence, classes)',
      );
    }

    return parsed;
  }

  private async generate(req: AIRequest, jsonFormat: boolean): Promise<Record<string, unknown>> {
    const prompt = req.messages.map((m) => m.content).join('\n');

    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.model ?? this.model,
          prompt,
          stream: false,
          format: jsonFormat ? 'json' : undefined,
          options: {
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
            ...(req.maxTokens !== undefined ? { num_predict: req.maxTokens } : {}),
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw this.mapHttpStatus(
          response.status,
          `Ollama /api/generate returned ${response.status}`,
        );
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BaseAIError) {
        throw error;
      }

      throw new ProviderUnavailableError('ollama', this.model, this.errorMessage(error));
    }
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
  private mapHttpStatus(status: number, message: string): BaseAIError {
    if (status === 429) {
      return new AIRateLimitError('ollama', this.model, message);
    }

    if (status === 401 || status === 403) {
      return new AIAuthenticationError('ollama', this.model, message);
    }

    return new ProviderUnavailableError('ollama', this.model, message);
  }

  private mapError(error: unknown): BaseAIError {
    if (error instanceof BaseAIError) {
      return error;
    }

    const status = (error as { status?: number }).status;

    if (typeof status === 'number') {
      return this.mapHttpStatus(status, this.errorMessage(error));
    }

    return new ProviderUnavailableError('ollama', this.model, this.errorMessage(error));
  }

  private toNumber(value: unknown): number {
    return typeof value === 'number' ? value : Number(value) || 0;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
