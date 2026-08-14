import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { ConfigService } from '../../../config/config.service';
import { ProviderSelectorService } from '../../ai/application/provider-selector.service';
import { DocSection } from '../domain/doc-document';
import { SectionFormat } from '../domain/doc-template';

/** Cache key prefix for enriched AI sections (documentation-generation R6). */
export const ENRICHMENT_CACHE_PREFIX = 'doc-enrich:';

/** Cache TTL — 90 days (documentation-generation R6). */
export const ENRICHMENT_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface EnrichSectionInput {
  sectionId: string;
  title: string;
  /** Source file contributing to the section — first cache-key component (R6). */
  filePath: string;
  /** Content hash of the section's deterministic data — second key component (R6). */
  contentHash: string;
  /** Deterministic context handed to the AI provider to write the section. */
  context: string;
}

/**
 * Builds the Redis cache key for an enriched section: `doc-enrich:{filePath}:{contentHash}`.
 * When the source files contributing to a section have not changed (same
 * contentHash) the cached AI response is reused without a provider call (R6).
 */
export function enrichmentCacheKey(filePath: string, contentHash: string): string {
  return `${ENRICHMENT_CACHE_PREFIX}${filePath}:${contentHash}`;
}

/**
 * AI section enrichment (documentation-generation R6, design decision B).
 *
 * A thin adapter over the exported `ProviderSelectorService` — it does NOT
 * pull in AIService / CapabilityPromptBuilder ("Modified Capabilities: None").
 * Flag-gated per `config.documentation.aiEnabled`; per-section, cache-checked,
 * and the resulting section is flagged `aiGenerated: true`.
 *
 * The Redis client mirrors the AiModule `REDIS_CLIENT` factory (task 6.4 wires
 * the provider for this module). Graceful degradation: a Redis failure is a
 * cache miss, never a pipeline failure.
 */
@Injectable()
export class DocEnricherService {
  private readonly logger = new Logger(DocEnricherService.name);

  constructor(
    private readonly providerSelector: ProviderSelectorService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /** Per-section AI gate (design: config.documentation.aiEnabled). */
  get enabled(): boolean {
    return this.configService.documentation.aiEnabled;
  }

  /**
   * Enrich one ai.enrich section. Returns the section unchanged when AI is
   * disabled; otherwise cache-checked → provider-call → cached, flagged
   * `aiGenerated: true`. Provider errors propagate (the pipeline fails at the
   * ai-enrichment stage, generation R3) so deterministic content is never
   * stored for a section that failed enrichment.
   */
  async enrichSection(section: DocSection, input: EnrichSectionInput): Promise<DocSection> {
    if (!this.enabled) {
      return section;
    }

    const key = enrichmentCacheKey(input.filePath, input.contentHash);

    const cached = await this.readCache(key);
    if (cached !== null) {
      this.logger.debug(`AI enrichment cache hit for section "${input.sectionId}"`);
      return this.enrichedSection(section, cached);
    }

    const provider = await this.providerSelector.getProvider();
    const response = await provider.complete({
      messages: [
        {
          role: 'system',
          content:
            'You are DevLens Architect, a senior software architect writing technical documentation from Knowledge Graph data. Produce Markdown only.',
        },
        {
          role: 'user',
          content: `Write the "${input.title}" section of the documentation.\n\nContext from the knowledge graph:\n${input.context}`,
        },
      ],
    });

    await this.writeCache(key, response.content);
    return this.enrichedSection(section, response.content);
  }

  private enrichedSection(section: DocSection, markdown: string): DocSection {
    return {
      ...section,
      format: SectionFormat.MARKDOWN,
      content: { markdown },
      aiGenerated: true,
    };
  }

  private async readCache(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`AI enrichment cache GET failed for "${key}" — treating as cache miss`);
      return null;
    }
  }

  private async writeCache(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ENRICHMENT_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`AI enrichment cache SET failed for "${key}" — skipping cache write`);
    }
  }
}
