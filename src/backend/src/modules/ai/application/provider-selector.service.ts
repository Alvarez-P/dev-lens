import { Inject, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../../config/config.service';
import { AIProvider } from '../domain/ai-provider.interface';
import { ProviderUnavailableError } from '../domain/ai-errors';
import { AI_PROVIDER_REGISTRY } from '../ai.tokens';

/**
 * Resolves the active provider from `ai.defaultProvider` and falls back to
 * the first available provider when the default is unhealthy. Transparent to
 * consumers — they always call `AIProvider.enrich()` (REQ-AP-006).
 */
@Injectable()
export class ProviderSelectorService {
  private readonly logger = new Logger(ProviderSelectorService.name);

  constructor(
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providers: ReadonlyMap<string, AIProvider>,
    private readonly configService: ConfigService,
  ) {}

  async getProvider(): Promise<AIProvider> {
    const { defaultProvider, defaultModel } = this.configService.ai;
    const configured = this.providers.get(defaultProvider);

    if (configured && (await configured.healthCheck())) {
      return configured;
    }

    if (configured) {
      this.logger.warn(
        `Provider "${defaultProvider}" (${defaultProvider}/${defaultModel}) is unavailable — falling back`,
      );
    }

    for (const [name, provider] of this.providers) {
      if (name === defaultProvider) {
        continue;
      }

      if (await provider.healthCheck()) {
        this.logger.warn(`Falling back to provider "${name}"`);
        return provider;
      }
    }

    throw new ProviderUnavailableError(
      defaultProvider,
      defaultModel,
      `No available AI provider (defaultProvider="${defaultProvider}", defaultModel="${defaultModel}")`,
    );
  }
}
