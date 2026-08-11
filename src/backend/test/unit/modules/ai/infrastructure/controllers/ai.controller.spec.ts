import {
  sanitizeErrorMessage,
  toSseSafeChunk,
  validateStreamParams,
} from '@/modules/ai/infrastructure/controllers/ai.controller';
import { AIChunk } from '@/modules/ai/domain/ai-request.vo';

describe('AIController pure helpers (PR13)', () => {
  describe('validateStreamParams', () => {
    it('should return null when all three params are present', () => {
      expect(validateStreamParams('explain-module', 'repo-1', 'src/orders/OrderService.ts')).toBe(
        null,
      );
    });

    it('should report the missing capability param', () => {
      expect(validateStreamParams(undefined, 'repo-1', 'src/orders/OrderService.ts')).toBe(
        'Missing required query parameter "capability"',
      );
    });

    it('should report the missing repoId param', () => {
      expect(validateStreamParams('explain-module', undefined, 'src/orders/OrderService.ts')).toBe(
        'Missing required query parameter "repoId"',
      );
    });

    it('should report the missing nodeId param', () => {
      expect(validateStreamParams('explain-module', 'repo-1', undefined)).toBe(
        'Missing required query parameter "nodeId"',
      );
    });

    it('should treat empty strings as missing', () => {
      expect(validateStreamParams('', 'repo-1', 'src/orders/OrderService.ts')).toBe(
        'Missing required query parameter "capability"',
      );
      expect(validateStreamParams('explain-module', '', 'src/orders/OrderService.ts')).toBe(
        'Missing required query parameter "repoId"',
      );
      expect(validateStreamParams('explain-module', 'repo-1', '')).toBe(
        'Missing required query parameter "nodeId"',
      );
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should map AI_AUTHENTICATION to a client-safe message', () => {
      expect(sanitizeErrorMessage('AI_AUTHENTICATION')).toBe('Authentication failed');
    });

    it('should map PROVIDER_UNAVAILABLE to a client-safe message', () => {
      expect(sanitizeErrorMessage('PROVIDER_UNAVAILABLE')).toBe('AI provider unavailable');
    });

    it('should map CONTEXT_BUDGET_EXCEEDED to a client-safe message', () => {
      expect(sanitizeErrorMessage('CONTEXT_BUDGET_EXCEEDED')).toBe('Context exceeds token budget');
    });

    it('should map CAPABILITY_NOT_FOUND to a client-safe message', () => {
      expect(sanitizeErrorMessage('CAPABILITY_NOT_FOUND')).toBe('Capability not found');
    });

    it('should hide unknown error codes behind a generic message', () => {
      expect(sanitizeErrorMessage('AI_RATE_LIMIT')).toBe('Internal error');
      expect(sanitizeErrorMessage('SOME_FUTURE_CODE')).toBe('Internal error');
    });

    it('should hide an absent code behind a generic message', () => {
      expect(sanitizeErrorMessage(undefined)).toBe('Internal error');
    });
  });

  describe('toSseSafeChunk', () => {
    it('should sanitize the content of error chunks but keep the code', () => {
      const chunk: AIChunk = {
        type: 'error',
        content: '401 invalid api key sk-proj-abc123',
        code: 'AI_AUTHENTICATION',
      };

      expect(toSseSafeChunk(chunk)).toEqual({
        type: 'error',
        content: 'Authentication failed',
        code: 'AI_AUTHENTICATION',
      });
    });

    it('should never leak the raw provider message for unknown error codes', () => {
      const chunk: AIChunk = {
        type: 'error',
        content: 'connection reset by 10.0.0.5:443',
        code: 'SOME_INTERNAL_DETAIL',
      };

      expect(toSseSafeChunk(chunk).content).toBe('Internal error');
    });

    it('should pass token chunks through unchanged', () => {
      const chunk: AIChunk = { type: 'token', content: 'The OrderService' };

      expect(toSseSafeChunk(chunk)).toBe(chunk);
    });

    it('should pass done chunks through unchanged with their metadata', () => {
      const chunk: AIChunk = { type: 'done', content: '', tokens: 150, model: 'gpt-4o' };

      expect(toSseSafeChunk(chunk)).toEqual(chunk);
    });
  });
});
