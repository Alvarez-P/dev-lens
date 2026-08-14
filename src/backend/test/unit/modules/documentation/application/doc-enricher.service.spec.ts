import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { DocSection } from '@/modules/documentation/domain/doc-document';
import {
  DocEnricherService,
  EnrichSectionInput,
  ENRICHMENT_CACHE_PREFIX,
  ENRICHMENT_CACHE_TTL_SECONDS,
} from '@/modules/documentation/application/doc-enricher.service';
import { ProviderSelectorService } from '@/modules/ai/application/provider-selector.service';

/**
 * Task 5.3 (PR4) — DocEnricherService (documentation-generation R6).
 * AI enrichment via the exported ProviderSelectorService, gated behind
 * `config.documentation.aiEnabled`, with a Redis 90-day cache keyed
 * `(filePath, contentHash)`. Cache hit → no provider call; miss → provider
 * call + cache write.
 */

class FakeProvider {
  complete = jest.fn();
}

function makeSection(id: string): DocSection {
  return {
    id,
    title: 'Project Overview',
    format: SectionFormat.MARKDOWN,
    content: { markdown: '' },
    aiGenerated: false,
  };
}

function makeInput(overrides: Partial<EnrichSectionInput> = {}): EnrichSectionInput {
  return {
    sectionId: 'project-overview',
    title: 'Project Overview',
    filePath: 'src/users/users.module.ts',
    contentHash: 'deadbeef',
    context: 'users module, 2 endpoints, 1 event',
    ...overrides,
  };
}

function makeService(options: { aiEnabled: boolean; cached?: string | null }) {
  const providerSelector = {
    getProvider: jest.fn().mockResolvedValue({ complete: new FakeProvider().complete }),
  } as unknown as ProviderSelectorService;
  const redis = {
    get: jest.fn().mockResolvedValue(options.cached ?? null),
    set: jest.fn().mockResolvedValue('OK'),
  } as unknown as { get: jest.Mock; set: jest.Mock };
  const configService = {
    documentation: { aiEnabled: options.aiEnabled },
  } as unknown as { documentation: { aiEnabled: boolean } };

  const service = new DocEnricherService(providerSelector, redis as never, configService as never);
  return { service, providerSelector, redis, configService };
}

describe('DocEnricherService (5.3) — AI section enrichment + 90d cache', () => {
  describe('flag gating (config.documentation.aiEnabled)', () => {
    it('should return the section unchanged and never call the provider when AI is disabled', async () => {
      const { service, providerSelector, redis } = makeService({ aiEnabled: false });

      const result = await service.enrichSection(makeSection('project-overview'), makeInput());

      expect(providerSelector.getProvider).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
      expect(result.content).toEqual({ markdown: '' });
      expect(result.aiGenerated).toBe(false);
    });

    it('should expose the AI-enabled state from config', () => {
      expect(makeService({ aiEnabled: true }).service.enabled).toBe(true);
      expect(makeService({ aiEnabled: false }).service.enabled).toBe(false);
    });
  });

  describe('cache (R6)', () => {
    it('should reuse the cached enrichment on a hit without calling the provider', async () => {
      const cachedMarkdown = 'Cached: the users module exposes a CRUD API.';
      const { service, providerSelector, redis } = makeService({
        aiEnabled: true,
        cached: cachedMarkdown,
      });

      const result = await service.enrichSection(makeSection('project-overview'), makeInput());

      expect(redis.get).toHaveBeenCalledWith(expect.stringContaining('deadbeef'));
      expect(providerSelector.getProvider).not.toHaveBeenCalled();
      expect(result.content).toEqual({ markdown: cachedMarkdown });
      expect(result.aiGenerated).toBe(true);
    });

    it('should call the provider on a cache miss and write the result to cache', async () => {
      const provider = new FakeProvider();
      provider.complete.mockResolvedValue({
        content: 'Fresh: the users module…',
        model: 'deepseek-chat',
        tokensUsed: { input: 10, output: 5 },
        finishReason: 'stop',
      });
      const providerSelector = {
        getProvider: jest.fn().mockResolvedValue({ complete: provider.complete }),
      } as unknown as ProviderSelectorService;
      const redis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      };
      const service = new DocEnricherService(
        providerSelector,
        redis as never,
        { documentation: { aiEnabled: true } } as never,
      );

      const result = await service.enrichSection(makeSection('project-overview'), makeInput());

      expect(providerSelector.getProvider).toHaveBeenCalled();
      expect(provider.complete).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('deadbeef'),
        'Fresh: the users module…',
        'EX',
        ENRICHMENT_CACHE_TTL_SECONDS,
      );
      expect(result.content).toEqual({ markdown: 'Fresh: the users module…' });
      expect(result.aiGenerated).toBe(true);
    });

    it('should use a 90-day TTL for cache entries', () => {
      expect(ENRICHMENT_CACHE_TTL_SECONDS).toBe(90 * 24 * 60 * 60);
    });

    it('should key the cache with filePath and contentHash (R6 key contract)', async () => {
      const { service, redis } = makeService({ aiEnabled: true, cached: null });
      const provider = {
        complete: jest.fn().mockResolvedValue({
          content: 'x',
          model: 'm',
          tokensUsed: { input: 0, output: 0 },
          finishReason: 'stop',
        }),
      };
      (
        service as unknown as { providerSelector: { getProvider: jest.Mock } }
      ).providerSelector.getProvider.mockResolvedValue(provider);

      await service.enrichSection(
        makeSection('overview'),
        makeInput({ filePath: 'src/users/users.module.ts', contentHash: 'abc123' }),
      );

      expect(redis.get).toHaveBeenCalledWith(
        `${ENRICHMENT_CACHE_PREFIX}src/users/users.module.ts:abc123`,
      );
    });
  });

  describe('provider failure propagation', () => {
    it('should propagate provider errors (pipeline fails at ai-enrichment stage)', async () => {
      const providerSelector = {
        getProvider: jest.fn().mockRejectedValue(new Error('provider down')),
      } as unknown as ProviderSelectorService;
      const service = new DocEnricherService(
        providerSelector,
        { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as never,
        { documentation: { aiEnabled: true } } as never,
      );

      await expect(service.enrichSection(makeSection('overview'), makeInput())).rejects.toThrow(
        'provider down',
      );
    });
  });
});
