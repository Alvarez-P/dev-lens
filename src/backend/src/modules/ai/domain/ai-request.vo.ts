import { AIClassifiedRole } from './ai-enrichment.entity';

export type AIMessageRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface AIRequest {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json_object';
}

export interface AIResponse {
  content: string;
  model: string;
  tokensUsed: TokenUsage;
  finishReason: string;
}

export type AIChunkType = 'token' | 'done' | 'error';

export interface AIChunk {
  type: AIChunkType;
  content: string;
  tokens?: number;
  cost?: number;
  model?: string;
  /**
   * Stable machine-readable error code carried on `error` chunks so the SSE
   * controller can pick a sanitized, client-safe message (ai-streaming R5).
   * Absent on token/done chunks.
   */
  code?: string;
}

export interface AIEnrichmentRequest extends AIRequest {
  /** Capability id, e.g. 'classify-lifecycle'. */
  capability: string;
  /** Framework id, e.g. 'nestjs'. */
  framework: string;
  /** Manifest sha256 cache key — matches the analysis manifest. */
  manifestSha256: string;
}

export interface AIEnrichmentResponse {
  framework: string;
  architecture: string;
  confidence: number;
  classes: AIClassifiedRole[];
}
