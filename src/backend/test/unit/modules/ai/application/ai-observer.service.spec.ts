import {
  AIObserver,
  AIEventDispatcher,
  AIMetrics,
  percentileMs,
} from '@/modules/ai/application/ai-observer.service';
import {
  AIRequestStartedEvent,
  AIStreamTokenEvent,
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
} from '@/modules/ai/domain/ai-request-events';
import { ContextCacheService } from '@/modules/ai/infrastructure/cache/context-cache.service';

/**
 * Task 4.1 (PR12) — AIObserver: 15 in-memory metrics, event dispatch, and
 * context-cache invalidation on completion (epic-008 observability R1-R4).
 */
describe('AIObserver.record — per-event metric updates', () => {
  let observer: AIObserver;

  beforeEach(() => {
    observer = new AIObserver();
  });

  it('should increment requests.total on AIRequestStartedEvent', () => {
    observer.dispatch(
      new AIRequestStartedEvent({
        capabilityId: 'explain-module',
        repoId: 'repo-1',
        nodeId: 'n',
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );

    const metrics = observer.getMetrics();
    expect(metrics.requests.total).toBe(1);
    expect(metrics.requests.completed).toBe(0);
    expect(metrics.requests.failed).toBe(0);
  });

  it('should bucket providers.usage and capability.usage per started request', () => {
    observer.record(
      new AIRequestStartedEvent({
        capabilityId: 'explain-module',
        repoId: 'r',
        nodeId: 'n',
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );
    observer.record(
      new AIRequestStartedEvent({
        capabilityId: 'explain-module',
        repoId: 'r',
        nodeId: 'n',
        providerName: 'ollama',
        model: 'llama3.2',
      }),
    );

    const metrics = observer.getMetrics();
    expect(metrics.providers.usage).toEqual({ openai: 1, ollama: 1 });
    expect(metrics.capability.usage).toEqual({ 'explain-module': 2 });
  });

  it('should accumulate tokens.total from AIStreamTokenEvent token lengths', () => {
    observer.record(
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 10, tokenLength: 16 }),
    );
    observer.record(
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 20, tokenLength: 5 }),
    );

    expect(observer.getMetrics().tokens.total).toBe(21);
  });

  it('should bump requests.completed and update duration/tokens/chunks gauges on completion', () => {
    observer.record(
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 10, tokenLength: 16 }),
    );
    observer.record(
      new AIRequestCompletedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        totalTokens: 128,
        totalChunks: 42,
        durationMs: 2500,
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );

    const metrics = observer.getMetrics();
    expect(metrics.requests.completed).toBe(1);
    expect(metrics.duration.avgMs).toBe(2500);
    expect(metrics.duration.p95Ms).toBe(2500);
    expect(metrics.stream.chunksAvg).toBe(42);
    // tokens.avgPerRequest = sampled tokens.total / completed requests.
    expect(metrics.tokens.avgPerRequest).toBe(16);
  });

  it('should average duration and chunks across multiple completed requests', () => {
    for (const durationMs of [100, 200, 300, 400, 500]) {
      observer.record(
        new AIRequestCompletedEvent({
          capabilityId: 'c',
          nodeId: 'n',
          totalTokens: 10,
          totalChunks: 10,
          durationMs,
          providerName: 'openai',
          model: 'gpt-4o',
        }),
      );
    }

    const metrics = observer.getMetrics();
    expect(metrics.requests.completed).toBe(5);
    expect(metrics.duration.avgMs).toBe(300);
    // ceil(0.95 * 5) = 5 → the 5th (max) duration.
    expect(metrics.duration.p95Ms).toBe(500);
    expect(metrics.stream.chunksAvg).toBe(10);
  });

  it('should count cache hits, misses and budget truncations from completion flags', () => {
    observer.record(
      new AIRequestCompletedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        totalTokens: 1,
        totalChunks: 1,
        durationMs: 1,
        providerName: 'p',
        model: 'm',
        cacheHit: true,
        truncated: true,
      }),
    );
    observer.record(
      new AIRequestCompletedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        totalTokens: 1,
        totalChunks: 1,
        durationMs: 1,
        providerName: 'p',
        model: 'm',
        cacheHit: false,
        truncated: false,
      }),
    );

    const metrics = observer.getMetrics();
    expect(metrics.cache.hits).toBe(1);
    expect(metrics.cache.misses).toBe(1);
    expect(metrics.budget.truncations).toBe(1);
  });

  it('should bump requests.failed and the error histogram on failure', () => {
    observer.record(
      new AIRequestFailedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: 'connection reset',
        durationMs: 800,
        providerName: 'openai',
      }),
    );
    observer.record(
      new AIRequestFailedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: 'timeout',
        durationMs: 900,
        providerName: 'openai',
      }),
    );

    const metrics = observer.getMetrics();
    expect(metrics.requests.failed).toBe(2);
    expect(metrics.errors.byCode).toEqual({ PROVIDER_UNAVAILABLE: 2 });
    expect(metrics.providers.errors).toEqual({ openai: 2 });
  });

  it('should not bucket providers.errors when the failure predates provider selection', () => {
    observer.record(
      new AIRequestFailedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        errorCode: 'CAPABILITY_NOT_FOUND',
        errorMessage: 'AI capability "ghost" is not registered',
        durationMs: 12,
      }),
    );

    const metrics = observer.getMetrics();
    expect(metrics.errors.byCode).toEqual({ CAPABILITY_NOT_FOUND: 1 });
    expect(metrics.providers.errors).toEqual({});
  });
});

describe('AIObserver.getMetrics / reset', () => {
  it('should return a snapshot of all 15 metrics with correct values', () => {
    const observer = new AIObserver();
    observer.record(
      new AIRequestStartedEvent({
        capabilityId: 'explain-module',
        repoId: 'repo-1',
        nodeId: 'n',
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );
    observer.record(
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 10, tokenLength: 20 }),
    );
    observer.record(
      new AIRequestCompletedEvent({
        capabilityId: 'explain-module',
        nodeId: 'n',
        totalTokens: 40,
        totalChunks: 8,
        durationMs: 1000,
        providerName: 'openai',
        model: 'gpt-4o',
        cacheHit: false,
        truncated: false,
      }),
    );

    const expected: AIMetrics = {
      requests: { total: 1, completed: 1, failed: 0 },
      tokens: { total: 20, avgPerRequest: 20 },
      duration: { avgMs: 1000, p95Ms: 1000 },
      errors: { byCode: {} },
      cache: { hits: 0, misses: 1 },
      providers: { usage: { openai: 1 }, errors: {} },
      budget: { truncations: 0 },
      capability: { usage: { 'explain-module': 1 } },
      stream: { chunksAvg: 8 },
    };

    expect(observer.getMetrics()).toEqual(expected);
  });

  it('should return a zeroed snapshot for a fresh observer', () => {
    const metrics = new AIObserver().getMetrics();

    expect(metrics).toEqual({
      requests: { total: 0, completed: 0, failed: 0 },
      tokens: { total: 0, avgPerRequest: 0 },
      duration: { avgMs: 0, p95Ms: 0 },
      errors: { byCode: {} },
      cache: { hits: 0, misses: 0 },
      providers: { usage: {}, errors: {} },
      budget: { truncations: 0 },
      capability: { usage: {} },
      stream: { chunksAvg: 0 },
    });
  });

  it('should zero every metric after reset()', () => {
    const observer = new AIObserver();
    observer.record(
      new AIRequestStartedEvent({
        capabilityId: 'c',
        repoId: 'r',
        nodeId: 'n',
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );
    observer.record(
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 10, tokenLength: 16 }),
    );
    observer.record(
      new AIRequestCompletedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        totalTokens: 1,
        totalChunks: 1,
        durationMs: 500,
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );
    observer.record(
      new AIRequestFailedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        errorCode: 'E',
        errorMessage: 'm',
        durationMs: 1,
      }),
    );

    observer.reset();

    expect(observer.getMetrics().requests).toEqual({ total: 0, completed: 0, failed: 0 });
    expect(observer.getMetrics().tokens).toEqual({ total: 0, avgPerRequest: 0 });
    expect(observer.getMetrics().duration).toEqual({ avgMs: 0, p95Ms: 0 });
    expect(observer.getMetrics().errors.byCode).toEqual({});
    expect(observer.getMetrics().cache).toEqual({ hits: 0, misses: 0 });
    expect(observer.getMetrics().providers).toEqual({ usage: {}, errors: {} });
    expect(observer.getMetrics().budget.truncations).toBe(0);
    expect(observer.getMetrics().capability.usage).toEqual({});
    expect(observer.getMetrics().stream.chunksAvg).toBe(0);
  });
});

describe('AIObserver — cache invalidation on completion', () => {
  it('should invalidate all depth variants for the capability when a request completes', async () => {
    const invalidate = jest.fn().mockResolvedValue(undefined);
    const cache = { invalidate } as unknown as jest.Mocked<ContextCacheService>;
    const observer = new AIObserver(cache);

    observer.record(
      new AIRequestCompletedEvent({
        capabilityId: 'explain-module',
        nodeId: 'src/orders/OrderService.ts',
        totalTokens: 10,
        totalChunks: 3,
        durationMs: 500,
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith('context:explain-module:*:*');
  });

  it('should not invalidate on started, token or failed events', () => {
    const invalidate = jest.fn().mockResolvedValue(undefined);
    const cache = { invalidate } as unknown as jest.Mocked<ContextCacheService>;
    const observer = new AIObserver(cache);

    observer.record(
      new AIRequestStartedEvent({
        capabilityId: 'c',
        repoId: 'r',
        nodeId: 'n',
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );
    observer.record(
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 10, tokenLength: 1 }),
    );
    observer.record(
      new AIRequestFailedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        errorCode: 'E',
        errorMessage: 'm',
        durationMs: 1,
      }),
    );

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('should degrade gracefully when no cache is injected', () => {
    const observer = new AIObserver();

    expect(() =>
      observer.record(
        new AIRequestCompletedEvent({
          capabilityId: 'c',
          nodeId: 'n',
          totalTokens: 1,
          totalChunks: 1,
          durationMs: 1,
          providerName: 'p',
          model: 'm',
        }),
      ),
    ).not.toThrow();
  });
});

describe('percentileMs (pure)', () => {
  it('should return the ceil(percentile * n)-th element of the sorted durations', () => {
    expect(percentileMs([100, 200, 300, 400, 500], 0.95)).toBe(500);
    expect(percentileMs([500, 100, 300, 400, 200], 0.95)).toBe(500); // unsorted input
  });

  it('should handle sub-max percentiles and single-element arrays', () => {
    expect(percentileMs([10, 20], 0.95)).toBe(20);
    expect(percentileMs([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.5)).toBe(50);
    expect(percentileMs([42], 0.95)).toBe(42);
  });

  it('should return 0 for an empty duration set', () => {
    expect(percentileMs([], 0.95)).toBe(0);
  });
});

describe('AIObserver implements AIEventDispatcher', () => {
  it('should accept events through the dispatcher interface', () => {
    const observer = new AIObserver();
    const dispatcher: AIEventDispatcher = observer;

    dispatcher.dispatch(
      new AIRequestStartedEvent({
        capabilityId: 'c',
        repoId: 'r',
        nodeId: 'n',
        providerName: 'openai',
        model: 'gpt-4o',
      }),
    );

    expect(observer.getMetrics().requests.total).toBe(1);
  });
});
