import { Injectable, Logger } from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';

import { AIProvider } from '../domain/ai-provider.interface';
import {
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
  AIRequest,
  AIResponse,
} from '../domain/ai-request.vo';
import {
  AIInvalidResponseError,
  AIRateLimitError,
  ProviderUnavailableError,
} from '../domain/ai-errors';

const DEFAULT_TIMEOUT_MS = 60_000;
const TOKENS_PER_4_CHARS = 0.25;

/**
 * Ollama provider adapter — zero-dependency `fetch` protocol (REQ-AP-003).
 * Uses POST /api/generate for completion and GET /api/tags for health.
 * Default provider for local development.
 */
@Injectable()
export class OllamaProvider implements AIProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

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

  streamComplete(_req: AIRequest): Observable<AIChunk> {
    // MVP deferred — interface present (REQ-AP-001).
    return EMPTY;
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
      throw new AIInvalidResponseError(
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
        if (response.status === 429) {
          throw new AIRateLimitError('ollama', this.model, 'Ollama rate limited');
        }

        throw new ProviderUnavailableError(
          'ollama',
          this.model,
          `Ollama /api/generate returned ${response.status}`,
        );
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AIRateLimitError || error instanceof ProviderUnavailableError) {
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

  private toNumber(value: unknown): number {
    return typeof value === 'number' ? value : Number(value) || 0;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
