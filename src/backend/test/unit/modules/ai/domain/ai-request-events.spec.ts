import {
  AIEvent,
  AIRequestStartedEvent,
  AIStreamTokenEvent,
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
} from '@/modules/ai/domain/ai-request-events';

/**
 * Task 4.1 (PR12) — AI request domain events (epic-008 orchestration).
 *
 * NOTE: this file lives alongside the ai-lifecycle `ai-events.spec.ts` (which
 * owns `ai-events.ts` with Enrichment*Event). The epic-008 events are the
 * AIRequest*Event family in `ai-request-events.ts` — see PR10 collision
 * precedent for the separate-file decision.
 */
describe('AIRequestStartedEvent', () => {
  it('should carry the full start payload and its type discriminator', () => {
    const event = new AIRequestStartedEvent({
      capabilityId: 'explain-module',
      repoId: 'repo-1',
      nodeId: 'src/orders/OrderService.ts',
      userId: 'user-42',
      providerName: 'openai',
      model: 'gpt-4o',
    });

    expect(event.type).toBe('AIRequestStarted');
    expect(event.payload.capabilityId).toBe('explain-module');
    expect(event.payload.repoId).toBe('repo-1');
    expect(event.payload.nodeId).toBe('src/orders/OrderService.ts');
    expect(event.payload.userId).toBe('user-42');
    expect(event.payload.providerName).toBe('openai');
    expect(event.payload.model).toBe('gpt-4o');
  });

  it('should keep userId optional when no authenticated user is present', () => {
    const event = new AIRequestStartedEvent({
      capabilityId: 'explain-module',
      repoId: 'repo-1',
      nodeId: 'src/orders/OrderService.ts',
      providerName: 'ollama',
      model: 'llama3.2',
    });

    expect(event.payload.userId).toBeUndefined();
  });

  it('should satisfy the AIEvent base contract (type + timestamp)', () => {
    const event = new AIRequestStartedEvent({
      capabilityId: 'explain-module',
      repoId: 'repo-1',
      nodeId: 'n',
      providerName: 'mock',
      model: 'mock',
    });

    const base: AIEvent = event;
    expect(base.type).toBe('AIRequestStarted');
    expect(typeof base.timestamp).toBe('number');
  });
});

describe('AIStreamTokenEvent', () => {
  it('should carry the chunk index and token length of the emitted chunk', () => {
    const event = new AIStreamTokenEvent({
      capabilityId: 'explain-module',
      nodeId: 'src/orders/OrderService.ts',
      chunkIndex: 10,
      tokenLength: 16,
    });

    expect(event.type).toBe('AIStreamToken');
    expect(event.payload.capabilityId).toBe('explain-module');
    expect(event.payload.nodeId).toBe('src/orders/OrderService.ts');
    expect(event.payload.chunkIndex).toBe(10);
    expect(event.payload.tokenLength).toBe(16);
  });
});

describe('AIRequestCompletedEvent', () => {
  it('should carry totals, duration, provider metadata and context flags', () => {
    const event = new AIRequestCompletedEvent({
      capabilityId: 'explain-module',
      nodeId: 'src/orders/OrderService.ts',
      totalTokens: 128,
      totalChunks: 42,
      durationMs: 2500,
      providerName: 'openai',
      model: 'gpt-4o',
      cacheHit: true,
      truncated: false,
    });

    expect(event.type).toBe('AIRequestCompleted');
    expect(event.payload.totalTokens).toBe(128);
    expect(event.payload.totalChunks).toBe(42);
    expect(event.payload.durationMs).toBe(2500);
    expect(event.payload.providerName).toBe('openai');
    expect(event.payload.model).toBe('gpt-4o');
    expect(event.payload.cacheHit).toBe(true);
    expect(event.payload.truncated).toBe(false);
  });

  it('should default the optional context flags to undefined', () => {
    const event = new AIRequestCompletedEvent({
      capabilityId: 'explain-module',
      nodeId: 'src/orders/OrderService.ts',
      totalTokens: 10,
      totalChunks: 3,
      durationMs: 500,
      providerName: 'mock',
      model: 'mock',
    });

    expect(event.payload.cacheHit).toBeUndefined();
    expect(event.payload.truncated).toBeUndefined();
  });
});

describe('AIRequestFailedEvent', () => {
  it('should carry the error code, message, duration and optional provider', () => {
    const event = new AIRequestFailedEvent({
      capabilityId: 'explain-module',
      nodeId: 'src/orders/OrderService.ts',
      errorCode: 'PROVIDER_UNAVAILABLE',
      errorMessage: 'connection reset',
      durationMs: 800,
      providerName: 'openai',
    });

    expect(event.type).toBe('AIRequestFailed');
    expect(event.payload.errorCode).toBe('PROVIDER_UNAVAILABLE');
    expect(event.payload.errorMessage).toBe('connection reset');
    expect(event.payload.durationMs).toBe(800);
    expect(event.payload.providerName).toBe('openai');
  });

  it('should allow a failed request before a provider was selected', () => {
    const event = new AIRequestFailedEvent({
      capabilityId: 'explain-module',
      nodeId: 'src/orders/OrderService.ts',
      errorCode: 'CAPABILITY_NOT_FOUND',
      errorMessage: 'AI capability "ghost" is not registered',
      durationMs: 12,
    });

    expect(event.payload.providerName).toBeUndefined();
  });
});

describe('AIRequest* event family invariants', () => {
  it('should give every event type a unique discriminator', () => {
    const types = [
      new AIRequestStartedEvent({
        capabilityId: 'c',
        repoId: 'r',
        nodeId: 'n',
        providerName: 'p',
        model: 'm',
      }).type,
      new AIStreamTokenEvent({ capabilityId: 'c', nodeId: 'n', chunkIndex: 1, tokenLength: 1 })
        .type,
      new AIRequestCompletedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        totalTokens: 1,
        totalChunks: 1,
        durationMs: 1,
        providerName: 'p',
        model: 'm',
      }).type,
      new AIRequestFailedEvent({
        capabilityId: 'c',
        nodeId: 'n',
        errorCode: 'E',
        errorMessage: 'm',
        durationMs: 1,
      }).type,
    ];

    expect(new Set(types).size).toBe(4);
  });

  it('should stamp a construction-time epoch-ms timestamp on every event', () => {
    const before = Date.now();
    const event = new AIRequestStartedEvent({
      capabilityId: 'c',
      repoId: 'r',
      nodeId: 'n',
      providerName: 'p',
      model: 'm',
    });
    const after = Date.now();

    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
    expect(event.payload.timestamp).toBe(event.timestamp);
  });

  it('should round-trip through JSON without losing type or payload', () => {
    const event = new AIRequestCompletedEvent({
      capabilityId: 'explain-module',
      nodeId: 'src/orders/OrderService.ts',
      totalTokens: 128,
      totalChunks: 42,
      durationMs: 2500,
      providerName: 'openai',
      model: 'gpt-4o',
    });

    const revived = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

    expect(revived).toEqual({
      type: 'AIRequestCompleted',
      timestamp: event.timestamp,
      payload: event.payload,
    });
  });
});
