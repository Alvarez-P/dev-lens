import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/** Cache key prefix for assembled AI context (spec: ai-context-assembly R3). */
export const CONTEXT_CACHE_PREFIX = 'context:';

/** Default context cache TTL — 5 minutes (spec: ai-context-assembly R3). */
export const CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Keys matched per SCAN iteration during pattern invalidation. */
const SCAN_BATCH_SIZE = 100;

/**
 * Build the Redis key for an assembled context entry: `context:{capability}:{nodeId}:{depth}`.
 * Must stay in sync with the invalidation pattern used on KnowledgeGraphUpdated.
 */
export function contextCacheKey(capability: string, nodeId: string, depth: number): string {
  return `${CONTEXT_CACHE_PREFIX}${capability}:${nodeId}:${depth}`;
}

/**
 * Redis-backed cache for assembled AI context.
 *
 * Entries are keyed `context:{capability}:{nodeId}:{depth}` with a 5-minute TTL so the
 * ContextAssembler (PR9) can serve repeated capability invocations without re-querying the
 * Knowledge Graph. Pattern invalidation (`invalidate`) clears entries when the KG is updated.
 *
 * Graceful degradation: Redis is a cache of convenience, never a correctness dependency. If
 * the client is down or a command fails, `get` degrades to a cache miss (null), `set` and
 * `invalidate` become no-ops — callers fall back to assembling context from the KG.
 */
@Injectable()
export class ContextCacheService {
  private readonly logger = new Logger(ContextCacheService.name);

  constructor(private readonly client: Redis) {}

  /** Read a cached context value; null on miss or when Redis is unavailable. */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Context cache GET failed for "${key}" — degrading to cache miss`);
      return null;
    }
  }

  /** Store a context value with an expiry; no-op when Redis is unavailable. */
  async set(key: string, value: string, ttlMs: number = CONTEXT_CACHE_TTL_MS): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlMs);
    } catch (error) {
      this.logger.warn(`Context cache SET failed for "${key}" — skipping write`);
    }
  }

  /**
   * Delete every key matching a glob pattern (e.g. `context:explain-module:*` on KG update).
   * Uses SCAN + pipelined DEL, never the blocking KEYS. No-op when Redis is unavailable.
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      const keys: string[] = [];

      do {
        const [nextCursor, batch] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          SCAN_BATCH_SIZE,
        );
        keys.push(...batch);
        cursor = nextCursor;
      } while (cursor !== '0');

      if (keys.length === 0) {
        return;
      }

      const pipeline = this.client.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`Context cache invalidate failed for "${pattern}" — skipping`);
    }
  }
}
