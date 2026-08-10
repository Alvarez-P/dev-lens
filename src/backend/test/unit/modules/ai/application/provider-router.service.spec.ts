import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { ProviderRouterService } from '@/modules/ai/application/provider-router.service';
import { CapabilityRegistryService } from '@/modules/ai/application/capability-registry.service';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import { AICapability, createCapability } from '@/modules/ai/domain/ai-capability';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';
import { createPromptTemplate } from '@/modules/ai/domain/prompt-template';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';
import {
  AIAuthenticationError,
  CapabilityNotFoundError,
  ProviderUnavailableError,
} from '@/modules/ai/domain/ai-errors';
import { AIRequest } from '@/modules/ai/domain/ai-request.vo';

const REQUEST: AIRequest = { messages: [{ role: 'user', content: 'explain this module' }] };

/** Capability built through the real entity factory (spec R1). */
function makeCapability(
  overrides: Partial<Parameters<typeof createCapability>[0]> = {},
): AICapability {
  return createCapability({
    id: 'explain-module',
    name: 'Explain Module',
    description: 'Summarize what a module does, its dependencies, and its role',
    version: 1,
    enabled: true,
    contextStrategy: createContextStrategy({
      targetNodeType: NodeType.MODULE,
      relationshipDepth: 1,
      includeDependents: true,
      includeDependencies: true,
      includeApiSurface: true,
      includeEventSurface: false,
      includeDomainContext: false,
    }),
    promptTemplate: createPromptTemplate({
      systemInstruction: 'You are a DevLens architect.',
      contextPlaceholder: '{{context}}',
      userQueryWrapper: 'Question: {query}',
      capabilityInstructions: 'Explain the module in the context.',
    }),
    outputFormat: createOutputFormat({ type: 'markdown' }),
    validationRules: [],
    ...overrides,
  });
}

/** Minimal AIProvider fake with jest stubs for the router's decision inputs. */
function makeProvider(overrides: Partial<AIProvider> & { id: string }): AIProvider {
  return {
    name: overrides.id,
    supportedModels: [],
    complete: jest.fn(),
    streamComplete: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    estimateCost: jest.fn().mockReturnValue(10),
    enrich: jest.fn(),
    ...overrides,
  } as unknown as AIProvider;
}

function buildRouter(providers: AIProvider[], capabilities: AICapability[]): ProviderRouterService {
  const registry = new CapabilityRegistryService();
  for (const capability of capabilities) {
    registry.register(capability);
  }

  return new ProviderRouterService(
    new Map(providers.map((provider) => [provider.id, provider])),
    registry,
  );
}

describe('ProviderRouterService — selection (spec R2)', () => {
  it('should select the lowest-cost healthy provider when the capability has no requirements', async () => {
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o'],
      estimateCost: jest.fn().mockReturnValue(100),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(10),
    });
    const router = buildRouter([openai, ollama], [makeCapability()]);

    const provider = await router.selectProvider('explain-module');

    expect(provider).toBe(ollama);
    expect(ollama.healthCheck).toHaveBeenCalled();
  });

  it('should prefer a provider matching the capability requirements regardless of cost', async () => {
    // Spec scenario: capability requires ["json_mode"]; OpenAI supports it,
    // Ollama does not — OpenAI is selected even though Ollama is cheaper.
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o', 'json_mode'],
      estimateCost: jest.fn().mockReturnValue(100),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(1),
    });
    const router = buildRouter(
      [openai, ollama],
      [makeCapability({ requiredCapabilities: ['json_mode'] })],
    );

    const provider = await router.selectProvider('explain-module');

    expect(provider).toBe(openai);
  });

  it('should exclude providers whose health check fails', async () => {
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o'],
      estimateCost: jest.fn().mockReturnValue(100),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(10),
      healthCheck: jest.fn().mockResolvedValue(false),
    });
    const router = buildRouter([openai, ollama], [makeCapability()]);

    const provider = await router.selectProvider('explain-module');

    expect(provider).toBe(openai);
    expect(ollama.healthCheck).toHaveBeenCalled();
  });

  it('should throw ProviderUnavailableError when no provider matches the capability requirements', async () => {
    const openai = makeProvider({ id: 'openai', supportedModels: ['gpt-4o'] });
    const router = buildRouter([openai], [makeCapability({ requiredCapabilities: ['json_mode'] })]);

    await expect(router.selectProvider('explain-module')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('should throw ProviderUnavailableError when all matching providers are unhealthy', async () => {
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      healthCheck: jest.fn().mockResolvedValue(false),
    });
    const router = buildRouter([ollama], [makeCapability()]);

    await expect(router.selectProvider('explain-module')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('should throw CapabilityNotFoundError for an unregistered capability', async () => {
    const openai = makeProvider({ id: 'openai', supportedModels: ['gpt-4o'] });
    const router = buildRouter([openai], []);

    await expect(router.selectProvider('missing-capability')).rejects.toBeInstanceOf(
      CapabilityNotFoundError,
    );
  });

  it('should throw ProviderUnavailableError when the capability is disabled', async () => {
    const openai = makeProvider({ id: 'openai', supportedModels: ['gpt-4o'] });
    const router = buildRouter([openai], [makeCapability({ id: 'frozen', enabled: false })]);

    await expect(router.selectProvider('frozen')).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('ProviderRouterService — retry and fallback (spec R4)', () => {
  it('should retry once on the same provider, then fall back to the next provider on retriable failure', async () => {
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o'],
      estimateCost: jest.fn().mockReturnValue(5),
      complete: jest
        .fn()
        .mockRejectedValue(new ProviderUnavailableError('openai', 'gpt-4o', 'timeout')),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(10),
      complete: jest.fn().mockResolvedValue({
        content: 'ok-from-ollama',
        model: 'llama3.2',
        tokensUsed: { input: 0, output: 0 },
        finishReason: 'stop',
      }),
    });
    const router = buildRouter([openai, ollama], [makeCapability()]);

    const result = await router.executeWithFallback('explain-module', REQUEST, (provider) =>
      provider.complete(REQUEST),
    );

    expect(result.content).toBe('ok-from-ollama');
    expect(openai.complete).toHaveBeenCalledTimes(2);
    expect(ollama.complete).toHaveBeenCalledTimes(1);
  });

  it('should return the response when the retry on the same provider succeeds', async () => {
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o'],
      estimateCost: jest.fn().mockReturnValue(5),
      complete: jest
        .fn()
        .mockRejectedValueOnce(new ProviderUnavailableError('openai', 'gpt-4o', 'timeout'))
        .mockResolvedValue({
          content: 'ok-from-openai',
          model: 'gpt-4o',
          tokensUsed: { input: 0, output: 0 },
          finishReason: 'stop',
        }),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(10),
      complete: jest.fn(),
    });
    const router = buildRouter([openai, ollama], [makeCapability()]);

    const result = await router.executeWithFallback('explain-module', REQUEST, (provider) =>
      provider.complete(REQUEST),
    );

    expect(result.content).toBe('ok-from-openai');
    expect(openai.complete).toHaveBeenCalledTimes(2);
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('should fail immediately without retry or fallback on authentication errors', async () => {
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o'],
      estimateCost: jest.fn().mockReturnValue(5),
      complete: jest
        .fn()
        .mockRejectedValue(new AIAuthenticationError('openai', 'gpt-4o', 'invalid key')),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(10),
      complete: jest.fn(),
    });
    const router = buildRouter([openai, ollama], [makeCapability()]);

    await expect(
      router.executeWithFallback('explain-module', REQUEST, (provider) =>
        provider.complete(REQUEST),
      ),
    ).rejects.toBeInstanceOf(AIAuthenticationError);

    expect(openai.complete).toHaveBeenCalledTimes(1);
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('should throw the last retriable error when every provider in the chain fails', async () => {
    const openai = makeProvider({
      id: 'openai',
      supportedModels: ['gpt-4o'],
      estimateCost: jest.fn().mockReturnValue(5),
      complete: jest
        .fn()
        .mockRejectedValue(new ProviderUnavailableError('openai', 'gpt-4o', 'down')),
    });
    const ollama = makeProvider({
      id: 'ollama',
      supportedModels: ['llama3.2'],
      estimateCost: jest.fn().mockReturnValue(10),
      complete: jest
        .fn()
        .mockRejectedValue(new ProviderUnavailableError('ollama', 'llama3.2', 'down')),
    });
    const router = buildRouter([openai, ollama], [makeCapability()]);

    await expect(
      router.executeWithFallback('explain-module', REQUEST, (provider) =>
        provider.complete(REQUEST),
      ),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);

    expect(openai.complete).toHaveBeenCalledTimes(2);
    expect(ollama.complete).toHaveBeenCalledTimes(2);
  });
});
