import { Injectable, Logger, Optional } from '@nestjs/common';

import { AIEvent } from '../domain/ai-request-events';
import {
  AIRequestStartedEvent,
  AIStreamTokenEvent,
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
} from '../domain/ai-request-events';
import {
  CONTEXT_CACHE_PREFIX,
  ContextCacheService,
} from '../infrastructure/cache/context-cache.service';

/** Every AI request lifecycle event dispatcher (task 4.1 / PR12). */
export interface AIEventDispatcher {
  dispatch(event: AIEvent): void;
}

/** Snapshot of the 15 in-memory AI metrics (observability R1). */
export interface AIMetrics {
  requests: { total: number; completed: number; failed: number };
  tokens: { total: number; avgPerRequest: number };
  duration: { avgMs: number; p95Ms: number };
  errors: { byCode: Record<string, number> };
  cache: { hits: number; misses: number };
  providers: { usage: Record<string, number>; errors: Record<string, number> };
  budget: { truncations: number };
  capability: { usage: Record<string, number> };
  stream: { chunksAvg: number };
}

/** Percentile (0..1) of a duration sample; 0 for an empty sample. Pure. */
export function percentileMs(durations: readonly number[], percentile: number): number {
  if (durations.length === 0) {
    return 0;
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));

  return sorted[index];
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * In-memory counter/histogram observer for the AI pipeline (task 4.1 / PR12).
 *
 * Receives the four AI request events (dispatched by AIService via the
 * `AIEventDispatcher` token `AI_OBSERVER`) and tracks 15 metrics. `getMetrics`
 * returns a snapshot — the metrics are intentionally NOT persisted (aggregated
 * dashboards / Prometheus are deferred, RFC-009 §9.2 non-MVP).
 *
 * The token sampling design is deliberate: `AIStreamTokenEvent` fires only for
 * every 10th chunk, so `tokens.total` (and the derived avg) are a sampled
 * estimate; the authoritative full count rides in `AIRequestCompletedEvent.totalTokens`.
 *
 * On completion the observer also invalidates the context cache for the
 * capability across all depth variants — for MVP the cache is always
 * invalidated (the KG update signal is wired in PR14). The cache is
 * `@Optional()`: without it the observer degrades to metrics-only.
 */
@Injectable()
export class AIObserver implements AIEventDispatcher {
  private readonly logger = new Logger(AIObserver.name);

  private requests = { total: 0, completed: 0, failed: 0 };
  private tokensTotal = 0;
  private completedDurationsMs: number[] = [];
  private completedChunks: number[] = [];
  private errorsByCode = new Map<string, number>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private providersUsage = new Map<string, number>();
  private providersErrors = new Map<string, number>();
  private budgetTruncations = 0;
  private capabilityUsage = new Map<string, number>();

  constructor(@Optional() private readonly contextCache?: ContextCacheService) {}

  /** `AIEventDispatcher` entry point — delegates to the metric recorder. */
  dispatch(event: AIEvent): void {
    this.record(event);
  }

  /** Main dispatch method: switches on event type and updates metrics. */
  record(event: AIEvent): void {
    if (event instanceof AIRequestStartedEvent) {
      this.requests.total += 1;
      this.bump(this.providersUsage, event.payload.providerName);
      this.bump(this.capabilityUsage, event.payload.capabilityId);
      return;
    }

    if (event instanceof AIStreamTokenEvent) {
      this.tokensTotal += event.payload.tokenLength;
      return;
    }

    if (event instanceof AIRequestCompletedEvent) {
      this.requests.completed += 1;
      this.completedDurationsMs.push(event.payload.durationMs);
      this.completedChunks.push(event.payload.totalChunks);

      if (event.payload.cacheHit === true) {
        this.cacheHits += 1;
      } else if (event.payload.cacheHit === false) {
        this.cacheMisses += 1;
      }

      if (event.payload.truncated === true) {
        this.budgetTruncations += 1;
      }

      this.invalidateCache(event.payload.capabilityId);
      return;
    }

    if (event instanceof AIRequestFailedEvent) {
      this.requests.failed += 1;
      this.bump(this.errorsByCode, event.payload.errorCode);

      if (event.payload.providerName !== undefined) {
        this.bump(this.providersErrors, event.payload.providerName);
      }
    }
  }

  /** Snapshot of all 15 current metrics. */
  getMetrics(): AIMetrics {
    const completed = this.requests.completed;

    return {
      requests: { ...this.requests },
      tokens: {
        total: this.tokensTotal,
        avgPerRequest: completed === 0 ? 0 : this.tokensTotal / completed,
      },
      duration: {
        avgMs: average(this.completedDurationsMs),
        p95Ms: percentileMs(this.completedDurationsMs, 0.95),
      },
      errors: { byCode: this.toRecord(this.errorsByCode) },
      cache: { hits: this.cacheHits, misses: this.cacheMisses },
      providers: {
        usage: this.toRecord(this.providersUsage),
        errors: this.toRecord(this.providersErrors),
      },
      budget: { truncations: this.budgetTruncations },
      capability: { usage: this.toRecord(this.capabilityUsage) },
      stream: { chunksAvg: average(this.completedChunks) },
    };
  }

  /** Resets all metrics to zero (testing). */
  reset(): void {
    this.requests = { total: 0, completed: 0, failed: 0 };
    this.tokensTotal = 0;
    this.completedDurationsMs = [];
    this.completedChunks = [];
    this.errorsByCode.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.providersUsage.clear();
    this.providersErrors.clear();
    this.budgetTruncations = 0;
    this.capabilityUsage.clear();
  }

  /**
   * For MVP the context cache is invalidated on every completion: the KG was
   * assumed updated, so all depth variants of the capability's context keys
   * (`context:{cap}:{nodeId}:{depth}`) are cleared. No-op when no cache is
   * injected (module wiring deferred to PR14).
   */
  private invalidateCache(capabilityId: string): void {
    if (this.contextCache === undefined) {
      return;
    }

    const pattern = `${CONTEXT_CACHE_PREFIX}${capabilityId}:*:*`;

    void this.contextCache.invalidate(pattern).catch((_error: unknown) => {
      this.logger.warn(`Context cache invalidation failed for "${pattern}" — skipping`);
    });
  }

  private bump(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private toRecord(map: Map<string, number>): Record<string, number> {
    return Object.fromEntries(map);
  }
}
