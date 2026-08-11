import { firstValueFrom, Observable, of } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import {
  AIService,
  buildStreamRequest,
  DEFAULT_TEMPERATURE,
  TOKEN_EVENT_EVERY_N_CHUNKS,
} from '@/modules/ai/application/ai.service';
import { AIEventDispatcher } from '@/modules/ai/application/ai-observer.service';
import {
  AIRequestStartedEvent,
  AIStreamTokenEvent,
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
} from '@/modules/ai/domain/ai-request-events';
import { ProviderRouterService } from '@/modules/ai/application/provider-router.service';
import { CapabilityRegistryService } from '@/modules/ai/application/capability-registry.service';
import { ContextAssembler } from '@/modules/ai/application/context-assembler.service';
import { AssembledContextEnvelope } from '@/modules/ai/application/context-assembler.service';
import { CapabilityPromptBuilder } from '@/modules/ai/application/capability-prompt-builder.service';
import { BuiltPrompt } from '@/modules/ai/application/capability-prompt-builder.service';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import { AICapability, createCapability } from '@/modules/ai/domain/ai-capability';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';
import { createPromptTemplate } from '@/modules/ai/domain/prompt-template';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';
import { AIChunk, AIRequest } from '@/modules/ai/domain/ai-request.vo';
import {
  AIAuthenticationError,
  CapabilityNotFoundError,
  ContextBudgetExceededError,
  ProviderUnavailableError,
} from '@/modules/ai/domain/ai-errors';

/**
 * Task 3.5 (PR11) — AIService orchestrator per the ai-streaming spec R1-R6:
 * route → context → prompt → stream → observe. All collaborators are mocked;
 * the service is the pipeline coordinator under test.
 */
const CAPABILITY_ID = 'explain-module';
const REPO_ID = 'repo-1';
const NODE_ID = 'src/orders/OrderService.ts';

function makeCapability(): AICapability {
  return createCapability({
    id: CAPABILITY_ID,
    name: 'Explain Module',
    description: 'Explain a module from KG context',
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
      capabilityInstructions: 'Explain the module.',
    }),
    outputFormat: createOutputFormat({ type: 'markdown' }),
    validationRules: [],
  });
}

function makeEnvelope(target: AssembledContextEnvelope['target'] = null): AssembledContextEnvelope {
  return {
    capability: CAPABILITY_ID,
    nodeId: NODE_ID,
    depth: 1,
    target,
    dependents: [],
    dependencies: [],
    apiSurface: [],
    eventSurface: [],
    domainContext: [],
    sourceFiles: ['src/orders/OrderService.ts'],
    content: '# Target\nOrderService (src/orders/OrderService.ts)',
    tokenEstimate: 10,
    truncated: false,
    truncationMarker: null,
    cacheHit: false,
  };
}

function makeBuiltPrompt(): BuiltPrompt {
  const system = 'You are a DevLens architect.';
  const user = '## Target Analysis\n<code>...</code>';

  return {
    system,
    user,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    tokenCount: 50,
    truncated: false,
    truncatedSections: [],
  };
}

describe('AIService.enrich (PR11 orchestrator)', () => {
  const router = {
    selectProvider: jest.fn(),
    executeWithFallback: jest.fn(),
  } as unknown as jest.Mocked<ProviderRouterService>;
  const registry = { get: jest.fn() } as unknown as jest.Mocked<CapabilityRegistryService>;
  const assembler = {
    assembleContext: jest.fn(),
  } as unknown as jest.Mocked<ContextAssembler>;
  const promptBuilder = {
    buildPrompt: jest.fn(),
  } as unknown as jest.Mocked<CapabilityPromptBuilder>;

  const streamCompleteMock = jest.fn();
  const provider: AIProvider = {
    id: 'openai',
    name: 'OpenAI',
    supportedModels: ['gpt-4o'],
    complete: jest.fn(),
    streamComplete: streamCompleteMock,
    healthCheck: jest.fn(),
    estimateCost: jest.fn(),
    enrich: jest.fn(),
  };

  const capability = makeCapability();
  const envelope = makeEnvelope({
    fqn: NODE_ID,
    label: 'OrderService',
    type: NodeType.MODULE,
    sourceFile: 'src/orders/OrderService.ts',
    properties: {},
  });
  const builtPrompt = makeBuiltPrompt();

  const tokenChunk: AIChunk = { type: 'token', content: 'The' };
  const secondTokenChunk: AIChunk = { type: 'token', content: ' OrderService' };
  const doneChunk: AIChunk = { type: 'done', content: '', tokens: 2, model: 'gpt-4o' };

  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    router.selectProvider.mockResolvedValue(provider);
    registry.get.mockReturnValue(capability);
    assembler.assembleContext.mockResolvedValue(envelope);
    promptBuilder.buildPrompt.mockResolvedValue(builtPrompt);
    streamCompleteMock.mockReturnValue(of(tokenChunk, secondTokenChunk, doneChunk));
    service = new AIService(router, registry, assembler, promptBuilder);
  });

  describe('happy path streaming', () => {
    it('should emit token chunks followed by a done chunk', async () => {
      const chunks = await firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks.filter((c) => c.type === 'token').map((c) => c.content)).toEqual([
        'The',
        ' OrderService',
      ]);
      expect(chunks[chunks.length - 1]).toEqual(doneChunk);
    });

    it('should route through selectProvider with the capability id', async () => {
      await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));

      expect(router.selectProvider).toHaveBeenCalledWith(CAPABILITY_ID);
    });

    it('should assemble context with repoId, nodeId and the capability', async () => {
      await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));

      expect(assembler.assembleContext).toHaveBeenCalledWith(REPO_ID, NODE_ID, capability);
    });

    it('should build the prompt with the capability and the assembled envelope', async () => {
      await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));

      expect(promptBuilder.buildPrompt).toHaveBeenCalledWith(capability, envelope);
    });

    it('should call streamComplete with an AIRequest built from the prompt', async () => {
      await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));

      expect(streamCompleteMock).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: builtPrompt.messages,
        temperature: DEFAULT_TEMPERATURE,
      } satisfies AIRequest);
    });
  });

  describe('error handling', () => {
    it('should emit an error chunk and complete when the capability is not registered', async () => {
      registry.get.mockImplementation(() => {
        throw new CapabilityNotFoundError('ghost-capability');
      });

      const chunks = await firstValueFrom(
        service.enrich('ghost-capability', REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('ghost-capability');
      // PR13: error chunks carry the machine-readable code the SSE controller
      // uses to pick a sanitized, client-safe message.
      expect(chunks[0].code).toBe('CAPABILITY_NOT_FOUND');
    });

    it('should emit an error chunk when the target node is not found in the KG', async () => {
      assembler.assembleContext.mockResolvedValue(makeEnvelope(null));

      const chunks = await firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain(NODE_ID);
    });

    it('should emit an error chunk and complete on provider authentication failure', async () => {
      streamCompleteMock.mockReturnValue(
        new Observable<AIChunk>((subscriber) => {
          subscriber.error(new AIAuthenticationError('openai', 'gpt-4o', 'invalid API key'));
        }),
      );

      const chunks = await firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toBe('invalid API key');
      expect(chunks[0].code).toBe('AI_AUTHENTICATION');
    });

    it('should emit an error chunk carrying budget info when the prompt exceeds the budget', async () => {
      promptBuilder.buildPrompt.mockRejectedValue(
        new ContextBudgetExceededError(
          'unknown',
          CAPABILITY_ID,
          'Prompt budget exceeded: currentTokens=6500, budget=6000',
        ),
      );

      const chunks = await firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('currentTokens=6500');
    });

    it('should emit an error chunk after partial tokens when the provider fails mid-stream', async () => {
      streamCompleteMock.mockReturnValue(
        new Observable<AIChunk>((subscriber) => {
          subscriber.next({ type: 'token', content: 'partial' });
          subscriber.error(new ProviderUnavailableError('openai', 'gpt-4o', 'connection reset'));
        }),
      );

      const chunks = await firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'token', content: 'partial' });
      expect(chunks[1].type).toBe('error');
    });

    it('should emit an error chunk when the router cannot select any provider', async () => {
      router.selectProvider.mockRejectedValue(
        new ProviderUnavailableError('', '', 'No available AI provider'),
      );

      const chunks = await firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('No available AI provider');
    });
  });

  describe('observable semantics', () => {
    it('should give each subscriber its own pipeline run (cold observable)', async () => {
      const first = firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));
      const second = firstValueFrom(
        service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
      );

      const [firstChunks, secondChunks] = await Promise.all([first, second]);

      expect(firstChunks).toEqual(secondChunks);
      expect(router.selectProvider).toHaveBeenCalledTimes(2);
    });

    it('should abort the provider stream when the subscriber unsubscribes', async () => {
      const teardown = jest.fn();
      let markSubscribed!: () => void;
      const subscribed = new Promise<void>((resolve) => {
        markSubscribed = resolve;
      });
      streamCompleteMock.mockReturnValue(
        new Observable<AIChunk>(() => {
          markSubscribed();
          return teardown;
        }),
      );

      const subscription = service
        .enrich(CAPABILITY_ID, REPO_ID, NODE_ID)
        .subscribe({ next: () => undefined });
      await subscribed;
      subscription.unsubscribe();

      expect(teardown).toHaveBeenCalled();
    });
  });
});

describe('AIService observer integration (PR12)', () => {
  const router = {
    selectProvider: jest.fn(),
  } as unknown as jest.Mocked<ProviderRouterService>;
  const registry = { get: jest.fn() } as unknown as jest.Mocked<CapabilityRegistryService>;
  const assembler = {
    assembleContext: jest.fn(),
  } as unknown as jest.Mocked<ContextAssembler>;
  const promptBuilder = {
    buildPrompt: jest.fn(),
  } as unknown as jest.Mocked<CapabilityPromptBuilder>;
  const dispatch = jest.fn();
  const observer = { dispatch } as unknown as jest.Mocked<AIEventDispatcher>;

  const streamCompleteMock = jest.fn();
  const provider: AIProvider = {
    id: 'openai',
    name: 'OpenAI',
    supportedModels: ['gpt-4o'],
    complete: jest.fn(),
    streamComplete: streamCompleteMock,
    healthCheck: jest.fn(),
    estimateCost: jest.fn(),
    enrich: jest.fn(),
  };

  const capability = makeCapability();
  const envelope = makeEnvelope({
    fqn: NODE_ID,
    label: 'OrderService',
    type: NodeType.MODULE,
    sourceFile: 'src/orders/OrderService.ts',
    properties: {},
  });
  const builtPrompt = makeBuiltPrompt();
  const doneChunk: AIChunk = { type: 'done', content: '', tokens: 2, model: 'gpt-4o' };

  function dispatched(): unknown[] {
    return dispatch.mock.calls.map((call) => call[0]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    router.selectProvider.mockResolvedValue(provider);
    registry.get.mockReturnValue(capability);
    assembler.assembleContext.mockResolvedValue(envelope);
    promptBuilder.buildPrompt.mockResolvedValue(builtPrompt);
  });

  it('should dispatch AIRequestStartedEvent with the request metadata once the pipeline is ready', async () => {
    const service = new AIService(router, registry, assembler, promptBuilder, observer);
    streamCompleteMock.mockReturnValue(of(doneChunk));

    await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID, 'user-1').pipe(toArray()));

    const started = dispatched().find(
      (event): event is AIRequestStartedEvent => event instanceof AIRequestStartedEvent,
    );
    expect(started).toBeDefined();
    expect(started!.payload).toMatchObject({
      capabilityId: CAPABILITY_ID,
      repoId: REPO_ID,
      nodeId: NODE_ID,
      userId: 'user-1',
      providerName: 'openai',
      model: 'gpt-4o',
    });
  });

  it('should dispatch AIStreamTokenEvent for every 10th chunk only', async () => {
    const service = new AIService(router, registry, assembler, promptBuilder, observer);
    const manyTokens: AIChunk[] = Array.from({ length: 22 }, () => ({
      type: 'token',
      content: 'x',
    }));
    streamCompleteMock.mockReturnValue(of(...manyTokens, doneChunk));

    await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));

    const tokenEvents = dispatched().filter(
      (event): event is AIStreamTokenEvent => event instanceof AIStreamTokenEvent,
    );
    expect(tokenEvents).toHaveLength(2);
    expect(tokenEvents.map((event) => event.payload.chunkIndex)).toEqual([10, 20]);
    expect(tokenEvents.every((event) => event.payload.tokenLength === 1)).toBe(true);
    expect(TOKEN_EVENT_EVERY_N_CHUNKS).toBe(10);
  });

  it('should dispatch AIRequestCompletedEvent with totals on stream completion', async () => {
    const service = new AIService(router, registry, assembler, promptBuilder, observer);
    streamCompleteMock.mockReturnValue(
      of({ type: 'token', content: 'The' }, { type: 'token', content: ' OrderService' }, doneChunk),
    );

    await firstValueFrom(service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()));

    const completed = dispatched().find(
      (event): event is AIRequestCompletedEvent => event instanceof AIRequestCompletedEvent,
    );
    expect(completed).toBeDefined();
    expect(completed!.payload).toMatchObject({
      capabilityId: CAPABILITY_ID,
      nodeId: NODE_ID,
      totalTokens: 16, // len('The') + len(' OrderService')
      totalChunks: 2,
      providerName: 'openai',
      model: 'gpt-4o',
      cacheHit: false,
      truncated: false,
    });
    expect(completed!.payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should dispatch AIRequestFailedEvent with the error code on mid-stream failure', async () => {
    const service = new AIService(router, registry, assembler, promptBuilder, observer);
    streamCompleteMock.mockReturnValue(
      new Observable<AIChunk>((subscriber) => {
        subscriber.next({ type: 'token', content: 'partial' });
        subscriber.error(new ProviderUnavailableError('openai', 'gpt-4o', 'connection reset'));
      }),
    );

    const chunks = await firstValueFrom(
      service.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
    );
    expect(chunks[chunks.length - 1].type).toBe('error');

    const failed = dispatched().find(
      (event): event is AIRequestFailedEvent => event instanceof AIRequestFailedEvent,
    );
    expect(failed).toBeDefined();
    expect(failed!.payload).toMatchObject({
      capabilityId: CAPABILITY_ID,
      nodeId: NODE_ID,
      errorCode: 'PROVIDER_UNAVAILABLE',
      errorMessage: 'connection reset',
      providerName: 'openai',
    });
    expect(dispatched().some((event) => event instanceof AIRequestCompletedEvent)).toBe(false);
  });

  it('should dispatch AIRequestFailedEvent when the pipeline fails before provider selection', async () => {
    const service = new AIService(router, registry, assembler, promptBuilder, observer);
    registry.get.mockImplementation(() => {
      throw new CapabilityNotFoundError('ghost-capability');
    });

    await firstValueFrom(service.enrich('ghost-capability', REPO_ID, NODE_ID).pipe(toArray()));

    const failed = dispatched().find(
      (event): event is AIRequestFailedEvent => event instanceof AIRequestFailedEvent,
    );
    expect(failed).toBeDefined();
    expect(failed!.payload).toMatchObject({
      capabilityId: 'ghost-capability',
      nodeId: NODE_ID,
      errorCode: 'CAPABILITY_NOT_FOUND',
    });
    expect(failed!.payload.providerName).toBeUndefined();
  });

  it('should not crash and not dispatch when no observer is injected', async () => {
    const bareService = new AIService(router, registry, assembler, promptBuilder);
    streamCompleteMock.mockReturnValue(
      of({ type: 'token', content: 'The' }, { type: 'token', content: ' OrderService' }, doneChunk),
    );

    const chunks = await firstValueFrom(
      bareService.enrich(CAPABILITY_ID, REPO_ID, NODE_ID).pipe(toArray()),
    );

    expect(chunks.filter((chunk) => chunk.type === 'token')).toHaveLength(2);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('buildStreamRequest (pure)', () => {
  const provider: AIProvider = {
    id: 'openai',
    name: 'OpenAI',
    supportedModels: ['gpt-4o'],
    complete: jest.fn(),
    streamComplete: jest.fn(),
    healthCheck: jest.fn(),
    estimateCost: jest.fn(),
    enrich: jest.fn(),
  };
  const prompt: BuiltPrompt = {
    system: 'sys',
    user: 'usr',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ],
    tokenCount: 2,
    truncated: false,
    truncatedSections: [],
  };

  it('should use the provider default model and the prompt messages', () => {
    expect(buildStreamRequest(provider, prompt)).toEqual({
      model: 'gpt-4o',
      messages: prompt.messages,
      temperature: DEFAULT_TEMPERATURE,
    });
  });

  it('should omit the model when the provider exposes no supported model', () => {
    const request = buildStreamRequest({ ...provider, supportedModels: [] }, prompt);

    expect(request.model).toBeUndefined();
    expect(request.messages).toEqual(prompt.messages);
    expect(request.temperature).toBe(DEFAULT_TEMPERATURE);
  });
});
