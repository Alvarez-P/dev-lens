import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { defer, from, Observable, of } from 'rxjs';
import { catchError, mergeMap, tap } from 'rxjs/operators';

import { DomainError } from '../../../shared/domain/domain-error';
import { AIProvider } from '../domain/ai-provider.interface';
import { AIChunk, AIRequest } from '../domain/ai-request.vo';
import {
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
  AIRequestStartedEvent,
  AIStreamTokenEvent,
} from '../domain/ai-request-events';
import { AI_OBSERVER } from '../ai.tokens';
import { AIEventDispatcher } from './ai-observer.service';
import { CapabilityRegistryService } from './capability-registry.service';
import { ProviderRouterService } from './provider-router.service';
import { ContextAssembler } from './context-assembler.service';
import { BuiltPrompt, CapabilityPromptBuilder } from './capability-prompt-builder.service';

/** Default sampling temperature when the capability does not specify one. */
export const DEFAULT_TEMPERATURE = 0.3;

/**
 * Token events are throttled: only every Nth chunk dispatches an
 * `AIStreamTokenEvent` so the observer's token counter samples the stream
 * instead of flooding on every chunk (task 4.1 / PR12).
 */
export const TOKEN_EVENT_EVERY_N_CHUNKS = 10;

/** The provider stream plus the metadata the observer events need. */
interface PipelineRun {
  stream: Observable<AIChunk>;
  providerName: string;
  model: string;
  cacheHit: boolean;
  truncated: boolean;
}

/**
 * Central orchestrator for the AI enrichment pipeline (task 3.5, PR11 +
 * task 4.1, PR12): route → context → prompt → stream → observe.
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
 * Observability (PR12): an optional `AIEventDispatcher` (token AI_OBSERVER,
 * wired in PR14) receives AIRequestStarted / AIStreamToken (every 10th chunk) /
 * AIRequestCompleted / AIRequestFailed events. When no observer is injected
 * the events are silently dropped.
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly router: ProviderRouterService,
    private readonly capabilityRegistry: CapabilityRegistryService,
    private readonly contextAssembler: ContextAssembler,
    private readonly promptBuilder: CapabilityPromptBuilder,
    @Optional()
    @Inject(AI_OBSERVER)
    private readonly observer?: AIEventDispatcher,
  ) {}

  /**
   * Stream an AI enrichment for one capability against one KG node.
   *
   * `defer` keeps the observable cold: every subscriber runs the full
   * pipeline (route → context → prompt) and receives its own provider
   * stream, so unsubscribing one consumer never tears down another. Per-
   * subscription state (token/chunk counters, start time, provider metadata)
   * is captured inside the `defer` callback so concurrent subscribers never
   * share counters.
   */
  enrich(
    capabilityId: string,
    repoId: string,
    nodeId: string,
    userId?: string,
  ): Observable<AIChunk> {
    return defer(() => {
      const startedAt = Date.now();
      let providerName: string;
      let model: string;
      let cacheHit: boolean | undefined;
      let truncated: boolean | undefined;
      let totalTokens = 0;
      let totalChunks = 0;

      return from(this.runPipeline(capabilityId, repoId, nodeId)).pipe(
        mergeMap((pipeline) => {
          providerName = pipeline.providerName;
          model = pipeline.model;
          cacheHit = pipeline.cacheHit;
          truncated = pipeline.truncated;

          this.observer?.dispatch(
            new AIRequestStartedEvent({
              capabilityId,
              repoId,
              nodeId,
              userId,
              providerName,
              model,
            }),
          );

          return pipeline.stream;
        }),
        tap({
          next: (chunk) => {
            if (chunk.type !== 'token') {
              return;
            }

            totalChunks += 1;
            totalTokens += chunk.content.length;

            if (totalChunks % TOKEN_EVENT_EVERY_N_CHUNKS === 0) {
              this.observer?.dispatch(
                new AIStreamTokenEvent({
                  capabilityId,
                  nodeId,
                  chunkIndex: totalChunks,
                  tokenLength: chunk.content.length,
                }),
              );
            }
          },
          complete: () => {
            // Only reachable after mergeMap assigned the provider metadata.
            this.observer?.dispatch(
              new AIRequestCompletedEvent({
                capabilityId,
                nodeId,
                totalTokens,
                totalChunks,
                durationMs: Date.now() - startedAt,
                providerName: providerName!,
                model: model!,
                cacheHit,
                truncated,
              }),
            );
          },
        }),
        catchError((error) => {
          this.observer?.dispatch(
            new AIRequestFailedEvent({
              capabilityId,
              nodeId,
              errorCode: errorCodeOf(error),
              errorMessage: errorMessage(error),
              durationMs: Date.now() - startedAt,
              providerName,
            }),
          );

          this.logger.warn(
            `AI enrichment failed for capability "${capabilityId}" node "${nodeId}": ${errorMessage(error)}`,
          );
          return of(toErrorChunk(error));
        }),
      );
    });
  }

  /** The async setup steps; returns the provider stream ready to be merged. */
  private async runPipeline(
    capabilityId: string,
    repoId: string,
    nodeId: string,
  ): Promise<PipelineRun> {
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
    return {
      stream: provider.streamComplete(buildStreamRequest(provider, builtPrompt)),
      providerName: provider.id,
      model: provider.supportedModels[0] ?? provider.name,
      cacheHit: envelope.cacheHit,
      truncated: envelope.truncated,
    };
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

/**
 * Renders a pipeline failure as an SSE-safe error chunk (ai-streaming R5).
 * The chunk carries the raw message for server-side logging plus the stable
 * error code the SSE controller uses to sanitize what the client sees.
 */
function toErrorChunk(error: unknown): AIChunk {
  return { type: 'error', content: errorMessage(error), code: errorCodeOf(error) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Classifies any failure into a stable error code for the observer. */
function errorCodeOf(error: unknown): string {
  return error instanceof DomainError ? error.code : 'UNKNOWN_ERROR';
}
