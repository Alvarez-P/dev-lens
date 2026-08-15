import * as path from 'path';
import { lastValueFrom, Observable, tap } from 'rxjs';
import { MockProvider } from '@/modules/ai/infrastructure/mock.provider';
import { AIChunk, AIEnrichmentRequest, AIRequest } from '@/modules/ai/domain/ai-request.vo';
import { ProviderUnavailableError } from '@/modules/ai/domain/ai-errors';
import { AIProviderConfig } from '@/config/configuration';
import { FileManifestService } from '@/modules/analysis/application/file-manifest.service';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../../src/modules/ai/ai.fixtures');

/** Mini-nestjs source corpus — its manifest sha keys the committed golden. */
const MINI_NESTJS_FIXTURE = path.resolve(__dirname, '../../../../fixtures/mini-nestjs');

/**
 * Golden key derived from the corpus the pipeline actually hashes — do NOT
 * hardcode the sha: a corpus edit would otherwise silently break the lookup
 * with an opaque ProviderUnavailableError instead of pointing at the fixture.
 */
const NESTJS_MANIFEST_SHA256 = FileManifestService.computeManifestSha256(
  new FileManifestService().computeManifest(MINI_NESTJS_FIXTURE),
);

const providerConfig: AIProviderConfig = {
  enabled: true,
};

const enrichmentRequest: AIEnrichmentRequest = {
  messages: [{ role: 'system', content: 'classify' }],
  capability: 'classify-lifecycle',
  framework: 'nestjs',
  manifestSha256: NESTJS_MANIFEST_SHA256,
};

describe('MockProvider', () => {
  describe('provider metadata', () => {
    it('should expose stable id, name and supportedModels for the router', () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      expect(provider.id).toBe('mock');
      expect(provider.name).toBe('Mock Provider');
      expect(provider.supportedModels).toEqual(['mock']);
    });

    it('should derive the model from the PR4 AIProviderConfig section', () => {
      const provider = new MockProvider({ enabled: true, defaultModel: 'llama3.2' }, FIXTURES_DIR);

      expect(provider.supportedModels).toEqual(['llama3.2']);
    });

    it('should fall back to the default model when no config section is provided', () => {
      const provider = new MockProvider(undefined, FIXTURES_DIR);

      expect(provider.supportedModels).toEqual(['mock']);
    });
  });

  describe('enrich', () => {
    it('should return the fixture matching capability + manifestSha256 exactly', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      const response = await provider.enrich(enrichmentRequest);

      expect(response.framework).toBe('nestjs');
      expect(response.architecture).toBe('mvc');
      expect(response.confidence).toBe(0.9);
      expect(response.classes).toHaveLength(6);
      expect(response.classes[0].role).toBe('controller');
      expect(response.classes[0].sourceFile).toBe('src/app.controller.ts');
    });

    it('should throw ProviderUnavailableError when no fixture exists for the sha256', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      await expect(
        provider.enrich({ ...enrichmentRequest, manifestSha256: 'nonexistent' }),
      ).rejects.toBeInstanceOf(ProviderUnavailableError);
    });

    it('should make no network requests', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      await provider.enrich(enrichmentRequest);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('complete', () => {
    it('should return a deterministic response without network', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

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
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      await expect(provider.healthCheck()).resolves.toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should return zero cost for mock', () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      expect(provider.estimateCost({ messages: [] })).toBe(0);
    });
  });

  describe('streamComplete', () => {
    const request: AIRequest = {
      messages: [{ role: 'user', content: 'explain users.controller.ts' }],
    };

    it('should stream deterministic token chunks and finish with a done chunk', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);
      const chunks: AIChunk[] = [];

      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunks.push(c))));

      const tokens = chunks.filter((c) => c.type === 'token').map((c) => c.content);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.join(' ')).toContain('mock');
      expect(chunks.at(-1)).toMatchObject({
        type: 'done',
        model: 'mock',
        tokens: tokens.length,
      });
    });

    it('should return the same deterministic stream for the same request', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      const first = await lastValueFrom(provider.streamComplete(request));
      const second = await lastValueFrom(provider.streamComplete(request));

      expect(first).toEqual(second);
    });

    it('should key the deterministic response on the request seed', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);
      const tokensFor = (content: string): Promise<AIChunk[]> => {
        const chunks: AIChunk[] = [];
        return lastValueFrom(
          provider
            .streamComplete({ messages: [{ role: 'user', content }] })
            .pipe(tap((c) => chunks.push(c))),
        ).then(() => chunks);
      };

      const tokensForSeedA = await tokensFor('seed-a');
      const tokensForSeedB = await tokensFor('seed-b');

      // Different seeds → different token ordering for the same canned response.
      expect(tokensForSeedA.map((c) => c.content)).not.toEqual(
        tokensForSeedB.map((c) => c.content),
      );
      expect(
        tokensForSeedA
          .filter((c) => c.type === 'token')
          .map((c) => c.content)
          .sort(),
      ).toEqual(
        tokensForSeedB
          .filter((c) => c.type === 'token')
          .map((c) => c.content)
          .sort(),
      );
    });

    it('should stream the same token order for the same request seed', async () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);
      const chunksA: AIChunk[] = [];
      const chunksB: AIChunk[] = [];

      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunksA.push(c))));
      await lastValueFrom(provider.streamComplete(request).pipe(tap((c) => chunksB.push(c))));

      expect(chunksA.map((c) => c.content)).toEqual(chunksB.map((c) => c.content));
    });

    it('should make no network requests', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      await lastValueFrom(provider.streamComplete(request));

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('should return an Observable even with an empty request', () => {
      const provider = new MockProvider(providerConfig, FIXTURES_DIR);

      expect(provider.streamComplete({ messages: [] })).toBeInstanceOf(Observable);
    });
  });
});
