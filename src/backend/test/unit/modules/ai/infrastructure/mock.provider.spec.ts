import * as path from 'path';
import { Observable } from 'rxjs';
import { MockProvider } from '@/modules/ai/infrastructure/mock.provider';
import { AIEnrichmentRequest } from '@/modules/ai/domain/ai-request.vo';
import { ProviderUnavailableError } from '@/modules/ai/domain/ai-errors';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../../src/modules/ai/ai.fixtures');

const enrichmentRequest: AIEnrichmentRequest = {
  messages: [{ role: 'system', content: 'classify' }],
  capability: 'classify-lifecycle',
  framework: 'nestjs',
  manifestSha256: 'abc123',
};

describe('MockProvider', () => {
  describe('enrich', () => {
    it('should return the fixture matching capability + manifestSha256 exactly', async () => {
      const provider = new MockProvider(FIXTURES_DIR);

      const response = await provider.enrich(enrichmentRequest);

      expect(response.framework).toBe('nestjs');
      expect(response.architecture).toBe('mvc');
      expect(response.confidence).toBe(0.9);
      expect(response.classes).toHaveLength(1);
      expect(response.classes[0].role).toBe('controller');
      expect(response.classes[0].sourceFile).toBe('src/users/users.controller.ts');
    });

    it('should throw ProviderUnavailableError when no fixture exists for the sha256', async () => {
      const provider = new MockProvider(FIXTURES_DIR);

      await expect(
        provider.enrich({ ...enrichmentRequest, manifestSha256: 'nonexistent' }),
      ).rejects.toBeInstanceOf(ProviderUnavailableError);
    });

    it('should make no network requests', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const provider = new MockProvider(FIXTURES_DIR);

      await provider.enrich(enrichmentRequest);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('complete', () => {
    it('should return a deterministic response without network', async () => {
      const provider = new MockProvider(FIXTURES_DIR);

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.content).toBeDefined();
      expect(response.model).toBe('mock');
      expect(response.tokensUsed).toEqual({ input: 0, output: 0 });
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('healthCheck', () => {
    it('should always return true (no network)', async () => {
      const provider = new MockProvider(FIXTURES_DIR);

      await expect(provider.healthCheck()).resolves.toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should return zero cost for mock', () => {
      const provider = new MockProvider(FIXTURES_DIR);

      expect(provider.estimateCost({ messages: [] })).toBe(0);
    });
  });

  describe('streamComplete', () => {
    it('should return an Observable (MVP stub)', () => {
      const provider = new MockProvider(FIXTURES_DIR);

      expect(provider.streamComplete({ messages: [] })).toBeInstanceOf(Observable);
    });
  });
});
