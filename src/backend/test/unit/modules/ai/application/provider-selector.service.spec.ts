import { Logger } from '@nestjs/common';
import { ProviderSelectorService } from '@/modules/ai/application/provider-selector.service';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import { AI_PROVIDER_REGISTRY } from '@/modules/ai/ai.tokens';
import { ProviderUnavailableError } from '@/modules/ai/domain/ai-errors';
import { AiConfig } from '@/config/configuration';

const aiConfig: AiConfig = {
  enabled: true,
  providers: {
    openai: { apiKeyEnv: 'OPENAI_API_KEY', defaultModel: 'gpt-4o', enabled: true },
    ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2', enabled: true },
    mock: { enabled: true },
  },
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o',
  timeoutMs: 60000,
  retry: { maxAttempts: 2, backoffMs: 1000 },
  budget: { maxTotalTokens: 6000 },
};

const fakeConfigService = {
  get ai(): AiConfig {
    return aiConfig;
  },
};

const healthy = (name: string): AIProvider =>
  ({
    healthCheck: jest.fn().mockResolvedValue(true),
    _name: name,
  }) as unknown as AIProvider;

const unhealthy = (name: string): AIProvider =>
  ({
    healthCheck: jest.fn().mockResolvedValue(false),
    _name: name,
  }) as unknown as AIProvider;

describe('ProviderSelectorService', () => {
  describe('getProvider', () => {
    it('should return the provider matching ai.defaultProvider when healthy', async () => {
      const openai = healthy('openai');
      const ollama = healthy('ollama');
      const registry = new Map<string, AIProvider>([
        ['openai', openai],
        ['ollama', ollama],
        ['mock', healthy('mock')],
      ]);
      const service = new ProviderSelectorService(registry, fakeConfigService as never);

      const provider = await service.getProvider();

      expect(provider).toBe(openai);
      expect(openai.healthCheck).toHaveBeenCalled();
    });

    it('should fall back to the first healthy provider when the default is unhealthy', async () => {
      const openai = unhealthy('openai');
      const ollama = healthy('ollama');
      const registry = new Map<string, AIProvider>([
        ['openai', openai],
        ['ollama', ollama],
      ]);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = new ProviderSelectorService(registry, fakeConfigService as never);

      const provider = await service.getProvider();

      expect(provider).toBe(ollama);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('openai'));
      warnSpy.mockRestore();
    });

    it('should throw ProviderUnavailableError when no provider is healthy', async () => {
      const registry = new Map<string, AIProvider>([
        ['openai', unhealthy('openai')],
        ['ollama', unhealthy('ollama')],
      ]);
      const service = new ProviderSelectorService(registry, fakeConfigService as never);

      await expect(service.getProvider()).rejects.toBeInstanceOf(ProviderUnavailableError);
    });
  });

  describe('registry injection', () => {
    it('should accept the AI_PROVIDER_REGISTRY token as a Map of providers', () => {
      const registry = new Map<string, AIProvider>();
      const service = new ProviderSelectorService(registry, fakeConfigService as never);

      expect(service).toBeInstanceOf(ProviderSelectorService);
      expect(AI_PROVIDER_REGISTRY).toBe('AI_PROVIDER_REGISTRY');
    });
  });
});
