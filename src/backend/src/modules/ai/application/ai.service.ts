import { Injectable, Logger } from '@nestjs/common';
import { defer, from, Observable, of } from 'rxjs';
import { catchError, mergeAll, tap } from 'rxjs/operators';

import { AIProvider } from '../domain/ai-provider.interface';
import { AIChunk, AIRequest } from '../domain/ai-request.vo';
import { CapabilityRegistryService } from './capability-registry.service';
import { ProviderRouterService } from './provider-router.service';
import { ContextAssembler } from './context-assembler.service';
import { BuiltPrompt, CapabilityPromptBuilder } from './capability-prompt-builder.service';

/** Default sampling temperature when the capability does not specify one. */
export const DEFAULT_TEMPERATURE = 0.3;

/**
 * Central orchestrator for the AI enrichment pipeline (task 3.5, PR11):
 * route → context → prompt → stream → observe.
 *
 * `enrich` composes the four application services into a single cold
 * Observable<AIChunk>: ProviderRouterService picks the best provider,
 * ContextAssembler builds the KG context envelope, CapabilityPromptBuilder
 * turns envelope + templates into a token-budgeted prompt, and the selected
 * provider's `streamComplete` yields the token stream. Every failure along the
 * pipeline — capability lookup, node lookup, budget, provider stream — is
 * converted into a single `{ type: 'error' }` chunk and the observable
 * completes (ai-streaming R5).
 *
 * Observability (AIRequest entity + domain events) is deferred to PR12
 * (AIObserver) — the stream currently passes through untouched.
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly router: ProviderRouterService,
    private readonly capabilityRegistry: CapabilityRegistryService,
    private readonly contextAssembler: ContextAssembler,
    private readonly promptBuilder: CapabilityPromptBuilder,
  ) {}

  /**
   * Stream an AI enrichment for one capability against one KG node.
   *
   * `defer` keeps the observable cold: every subscriber runs the full
   * pipeline (route → context → prompt) and receives its own provider
   * stream, so unsubscribing one consumer never tears down another.
   */
  enrich(
    capabilityId: string,
    repoId: string,
    nodeId: string,
    _userId?: string,
  ): Observable<AIChunk> {
    return defer(() =>
      from(this.runPipeline(capabilityId, repoId, nodeId)).pipe(
        mergeAll(),
        // PR12: AIObserver integration — observe provider stream events here.
        tap(() => undefined),
        catchError((error) => {
          this.logger.warn(
            `AI enrichment failed for capability "${capabilityId}" node "${nodeId}": ${errorMessage(error)}`,
          );
          return of(toErrorChunk(error));
        }),
      ),
    );
  }

  /** The async setup steps; returns the provider stream ready to be merged. */
  private async runPipeline(
    capabilityId: string,
    repoId: string,
    nodeId: string,
  ): Promise<Observable<AIChunk>> {
    // Step 1 — route: pick the best provider for the capability.
    const provider = await this.router.selectProvider(capabilityId);
    const capability = this.capabilityRegistry.get(capabilityId);

    // Step 2 — context: assemble the KG neighborhood envelope.
    const envelope = await this.contextAssembler.assembleContext(repoId, nodeId, capability);

    if (envelope.target === null) {
      throw new Error(`Node "${nodeId}" not found in knowledge graph`);
    }

    // Step 3 — prompt: substitute the envelope into the versioned templates.
    const builtPrompt = await this.promptBuilder.buildPrompt(capability, envelope);

    // Step 4 — stream: delegate to the provider's token stream.
    return provider.streamComplete(buildStreamRequest(provider, builtPrompt));
  }
}

/**
 * Builds the AIRequest handed to the provider from the assembled prompt.
 * The model defaults to the provider's first supported model (its configured
 * default, e.g. `gpt-4o`); `maxTokens` is intentionally left unset — the
 * provider applies its own response-length default.
 */
export function buildStreamRequest(provider: AIProvider, builtPrompt: BuiltPrompt): AIRequest {
  return {
    model: provider.supportedModels[0] ?? undefined,
    messages: builtPrompt.messages,
    temperature: DEFAULT_TEMPERATURE,
  };
}

/** Renders a pipeline failure as an SSE-safe error chunk (ai-streaming R5). */
function toErrorChunk(error: unknown): AIChunk {
  return { type: 'error', content: errorMessage(error) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
