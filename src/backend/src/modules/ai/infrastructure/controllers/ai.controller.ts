import { Controller, Logger, Query, Req, Sse } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import { fromEvent, Observable, of } from 'rxjs';
import { map, takeUntil, tap } from 'rxjs/operators';

import { AIService } from '../../application/ai.service';
import { AIChunk } from '../../domain/ai-request.vo';

/**
 * Client-safe replacement for each internal error code (ai-streaming R5):
 * the raw provider messages stay server-side, only these fixed strings ever
 * reach the browser. Codes are the stable `DomainError.code` values emitted
 * by AIService on its error chunks.
 */
const SANITIZED_MESSAGES: Readonly<Record<string, string>> = {
  AI_AUTHENTICATION: 'Authentication failed',
  PROVIDER_UNAVAILABLE: 'AI provider unavailable',
  CONTEXT_BUDGET_EXCEEDED: 'Context exceeds token budget',
  CAPABILITY_NOT_FOUND: 'Capability not found',
};

/** Fallback for unknown or absent codes — never leaks internals. */
const FALLBACK_ERROR_MESSAGE = 'Internal error';

/** Returns a validation error message, or null when all params are present. */
export function validateStreamParams(
  capabilityId: string | undefined,
  repoId: string | undefined,
  nodeId: string | undefined,
): string | null {
  if (!capabilityId) {
    return 'Missing required query parameter "capability"';
  }
  if (!repoId) {
    return 'Missing required query parameter "repoId"';
  }
  if (!nodeId) {
    return 'Missing required query parameter "nodeId"';
  }
  return null;
}

/** Maps an internal error code to a sanitized, client-safe message. */
export function sanitizeErrorMessage(code: string | undefined): string {
  if (!code) {
    return FALLBACK_ERROR_MESSAGE;
  }
  return SANITIZED_MESSAGES[code] ?? FALLBACK_ERROR_MESSAGE;
}

/**
 * Converts an internal chunk into an SSE-safe chunk. Token/done chunks pass
 * through untouched; error chunks keep their code but replace the content
 * with the sanitized message so provider internals never reach the client.
 */
export function toSseSafeChunk(chunk: AIChunk): AIChunk {
  if (chunk.type !== 'error') {
    return chunk;
  }
  return { type: 'error', content: sanitizeErrorMessage(chunk.code), code: chunk.code };
}

/**
 * SSE transport for the AI orchestration pipeline (task 4.2, PR13).
 *
 * `GET /ai/stream?capability=&repoId=&nodeId=` streams the AIProvider token
 * stream as `text/event-stream`. Each chunk is emitted as a single JSON
 * `data:` event; a final `done` chunk closes the stream; failures become a
 * single sanitized `error` event (ai-streaming R1/R2/R5). When the client
 * disconnects the source observable is unsubscribed so the provider request
 * is aborted (ai-streaming R4).
 *
 * No interceptor wraps this endpoint (the app registers no global
 * interceptors — verified in main.ts/app.module.ts), so responses are never
 * buffered and tokens flush as they are produced.
 */
@Controller('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(private readonly aiService: AIService) {}

  @Sse('stream')
  stream(
    @Query('capability') capabilityId: string,
    @Query('repoId') repoId: string,
    @Query('nodeId') nodeId: string,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    const validationError = validateStreamParams(capabilityId, repoId, nodeId);
    if (validationError !== null) {
      return of({
        data: JSON.stringify({ type: 'error', content: validationError, code: 'INVALID_PARAMS' }),
      });
    }

    // Client disconnect (EventSource.close / socket teardown) completes the
    // source observable, propagating the unsubscribe to the provider stream
    // which aborts the in-flight request (ai-streaming R4).
    const close$ = fromEvent(req, 'close');

    return this.aiService.enrich(capabilityId, repoId, nodeId).pipe(
      takeUntil(close$),
      tap({
        next: (chunk) => {
          if (chunk.type === 'error') {
            // Log the real failure for diagnostics; the client only ever sees
            // the sanitized message produced by toSseSafeChunk below.
            this.logger.warn(
              `AI stream failed for capability "${capabilityId}" (${chunk.code}): ${chunk.content}`,
            );
          }
        },
      }),
      map((chunk) => ({ data: JSON.stringify(toSseSafeChunk(chunk)) })),
    );
  }
}
