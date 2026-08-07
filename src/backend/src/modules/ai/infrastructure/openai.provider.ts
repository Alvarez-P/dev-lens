import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
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
  AIDidNotMeetSchemaError,
  AIInvalidResponseError,
  AIRateLimitError,
  ProviderUnavailableError,
} from '../domain/ai-errors';

const DEFAULT_TIMEOUT_MS = 60_000;
const TOKENS_PER_4_CHARS = 0.25;

/**
 * OpenAI provider adapter — the only place the `openai` SDK is used
 * (REQ-AP-003). Adapts AIRequest → chat.completions.create and wraps
 * provider-native errors as typed AIError subtypes.
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI | null;

  constructor(
    private readonly model: string,
    apiKey: string | undefined,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    if (!apiKey) {
      this.logger.warn(
        `OpenAI API key missing — healthCheck() will return false, enrichment falls back`,
      );
      this.client = null;
    } else {
      this.client = new OpenAI({ apiKey, timeout: timeoutMs });
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

  streamComplete(_req: AIRequest): Observable<AIChunk> {
    // MVP deferred — interface present (REQ-AP-001).
    return EMPTY;
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

  private mapError(error: unknown): Error {
    const status = (error as { status?: number }).status;

    if (status === 429) {
      return new AIRateLimitError('openai', this.model, this.errorMessage(error));
    }

    return new ProviderUnavailableError('openai', this.model, this.errorMessage(error));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
