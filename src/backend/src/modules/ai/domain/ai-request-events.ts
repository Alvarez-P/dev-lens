/**
 * AI request lifecycle domain events (epic-008, task 4.1 / PR12).
 *
 * NOTE: the name `ai-events.ts` is owned by the ai-lifecycle enrichment
 * pipeline (EnrichmentStarted/Completed/Failed/SkippedEvent implementing the
 * shared `DomainEvent` interface). This epic-008 family lives in a separate
 * file — same collision precedent as PR10's CapabilityPromptBuilder.
 *
 * Each event carries a `type` discriminator and a construction-time epoch-ms
 * `timestamp` via the common `AIEvent` base, plus a `payload` object with the
 * per-event fields. Events are plain data — throttling (every 10th chunk) and
 * dispatch decisions are the emitter's responsibility (see AIService).
 */

/** The one field every AI event payload shares. */
export interface AIEventPayload {
  /** Epoch ms at which the event was created. */
  timestamp: number;
}

/** Base class for every AI request lifecycle event (type + timestamp). */
export abstract class AIEvent<P extends AIEventPayload = AIEventPayload> {
  /** Event discriminator — unique per concrete event class. */
  abstract readonly type: string;

  /** Epoch ms at which the event was created (mirrors `payload.timestamp`). */
  readonly timestamp: number;

  constructor(readonly payload: P) {
    this.timestamp = payload.timestamp;
  }
}

export interface AIRequestStartedPayload {
  /** Capability id, e.g. 'explain-module'. */
  capabilityId: string;
  /** Repository the target node belongs to. */
  repoId: string;
  /** Target node FQN being enriched. */
  nodeId: string;
  /** Authenticated user, when available. */
  userId?: string;
  /** Provider id selected by the router, e.g. 'openai'. */
  providerName: string;
  /** Model that will serve the request. */
  model: string;
  timestamp: number;
}

/** Emitted when the request enters the streaming pipeline. */
export class AIRequestStartedEvent extends AIEvent<AIRequestStartedPayload> {
  readonly type = 'AIRequestStarted';

  constructor(payload: Omit<AIRequestStartedPayload, 'timestamp'>) {
    super({ ...payload, timestamp: Date.now() });
  }
}

export interface AIStreamTokenPayload {
  capabilityId: string;
  nodeId: string;
  /** 1-based index of the token chunk that triggered the event (every 10th). */
  chunkIndex: number;
  /** Length of the chunk content that triggered the event. */
  tokenLength: number;
  timestamp: number;
}

/**
 * Emitted for every Nth token chunk (N = 10 in the AIService wiring) so the
 * observer gets a sampled token counter without flooding on every chunk.
 */
export class AIStreamTokenEvent extends AIEvent<AIStreamTokenPayload> {
  readonly type = 'AIStreamToken';

  constructor(payload: Omit<AIStreamTokenPayload, 'timestamp'>) {
    super({ ...payload, timestamp: Date.now() });
  }
}

export interface AIRequestCompletedPayload {
  capabilityId: string;
  nodeId: string;
  /** Total token length streamed (chars — ~4 chars/token heuristic). */
  totalTokens: number;
  /** Total number of token chunks emitted by the provider. */
  totalChunks: number;
  /** Elapsed ms from request start to stream completion. */
  durationMs: number;
  providerName: string;
  model: string;
  /** Context cache hit flag from the assembler envelope (optional until wired). */
  cacheHit?: boolean;
  /** Context budget truncation flag from the assembler envelope (optional until wired). */
  truncated?: boolean;
  timestamp: number;
}

/** Emitted when the provider stream completes successfully. */
export class AIRequestCompletedEvent extends AIEvent<AIRequestCompletedPayload> {
  readonly type = 'AIRequestCompleted';

  constructor(payload: Omit<AIRequestCompletedPayload, 'timestamp'>) {
    super({ ...payload, timestamp: Date.now() });
  }
}

export interface AIRequestFailedPayload {
  capabilityId: string;
  nodeId: string;
  /** Classified error code, e.g. 'PROVIDER_UNAVAILABLE' or 'UNKNOWN_ERROR'. */
  errorCode: string;
  /** Sanitized, human-readable error message. */
  errorMessage: string;
  /** Elapsed ms from request start to failure. */
  durationMs: number;
  /** Provider id, when the failure happened after provider selection. */
  providerName?: string;
  timestamp: number;
}

/** Emitted when the request fails (pipeline setup or mid-stream). */
export class AIRequestFailedEvent extends AIEvent<AIRequestFailedPayload> {
  readonly type = 'AIRequestFailed';

  constructor(payload: Omit<AIRequestFailedPayload, 'timestamp'>) {
    super({ ...payload, timestamp: Date.now() });
  }
}
