import Redis from 'ioredis';
import {
  ContextCacheService,
  CONTEXT_CACHE_PREFIX,
  CONTEXT_CACHE_TTL_MS,
  contextCacheKey,
} from '@/modules/ai/infrastructure/cache/context-cache.service';

type MockRedis = {
  get: jest.Mock;
  set: jest.Mock;
  scan: jest.Mock;
  pipeline: jest.Mock;
};

const createMockRedis = (): MockRedis => ({
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  pipeline: jest.fn(),
});

const createService = (mock: MockRedis): ContextCacheService =>
  new ContextCacheService(mock as unknown as Redis);

describe('ContextCacheService', () => {
  let mockRedis: MockRedis;
  let service: ContextCacheService;

  beforeEach(() => {
    mockRedis = createMockRedis();
    service = createService(mockRedis);
  });

  describe('cache key contract', () => {
    it('should expose the context: prefix', () => {
      expect(CONTEXT_CACHE_PREFIX).toBe('context:');
    });

    it('should default TTL to 5 minutes', () => {
      expect(CONTEXT_CACHE_TTL_MS).toBe(5 * 60 * 1000);
      expect(CONTEXT_CACHE_TTL_MS).toBe(300_000);
    });

    it('should build keys as context:{capability}:{nodeId}:{depth}', () => {
      expect(contextCacheKey('explain-module', 'node-42', 1)).toBe(
        'context:explain-module:node-42:1',
      );
    });

    it('should build keys for slash-prefixed FQN node ids', () => {
      expect(contextCacheKey('explain-service', 'src/orders/OrderService.ts', 2)).toBe(
        'context:explain-service:src/orders/OrderService.ts:2',
      );
    });
  });

  describe('get', () => {
    it('should return the cached value when present', async () => {
      mockRedis.get.mockResolvedValue('{"truncated":false}');

      await expect(service.get('context:explain-module:node-42:1')).resolves.toBe(
        '{"truncated":false}',
      );
    });

    it('should pass the exact key to Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.get('context:explain-module:node-42:1');

      expect(mockRedis.get).toHaveBeenCalledWith('context:explain-module:node-42:1');
    });

    it('should return null when the key is absent', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.get('context:explain-module:node-42:1')).resolves.toBeNull();
    });

    it('should return null without throwing when Redis is down', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED redis://localhost:6379'));

      await expect(service.get('context:explain-module:node-42:1')).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('should store the value with an EX TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('context:explain-module:node-42:1', '{"truncated":false}', 120_000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'context:explain-module:node-42:1',
        '{"truncated":false}',
        'EX',
        120_000,
      );
    });

    it('should default the TTL to 5 minutes when omitted', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('context:explain-module:node-42:1', '{"truncated":false}');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'context:explain-module:node-42:1',
        '{"truncated":false}',
        'EX',
        300_000,
      );
    });

    it('should resolve without throwing when Redis is down', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED redis://localhost:6379'));

      await expect(
        service.set('context:explain-module:node-42:1', '{"truncated":false}'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidate', () => {
    it('should delete every key matching the pattern', async () => {
      mockRedis.scan.mockResolvedValueOnce([
        '0',
        ['context:explain-module:node-42:1', 'context:explain-module:node-7:1'],
      ]);
      const pipelineDel = jest.fn();
      const pipelineExec = jest.fn().mockResolvedValue([]);
      mockRedis.pipeline.mockReturnValue({ del: pipelineDel, exec: pipelineExec });

      await service.invalidate('context:explain-module:*');

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'context:explain-module:*',
        'COUNT',
        100,
      );
      expect(pipelineDel).toHaveBeenNthCalledWith(1, 'context:explain-module:node-42:1');
      expect(pipelineDel).toHaveBeenNthCalledWith(2, 'context:explain-module:node-7:1');
      expect(pipelineExec).toHaveBeenCalledTimes(1);
    });

    it('should iterate multi-cursor scans until exhaustion', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['17', ['context:explain-module:node-42:1']])
        .mockResolvedValueOnce(['0', ['context:explain-module:node-7:1']]);
      const pipelineDel = jest.fn();
      const pipelineExec = jest.fn().mockResolvedValue([]);
      mockRedis.pipeline.mockReturnValue({ del: pipelineDel, exec: pipelineExec });

      await service.invalidate('context:explain-module:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(pipelineDel).toHaveBeenCalledTimes(2);
    });

    it('should be a no-op when no keys match', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await service.invalidate('context:explain-module:*');

      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it('should resolve without throwing when Redis is down', async () => {
      mockRedis.scan.mockRejectedValue(new Error('ECONNREFUSED redis://localhost:6379'));

      await expect(service.invalidate('context:explain-module:*')).resolves.toBeUndefined();
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });
});
