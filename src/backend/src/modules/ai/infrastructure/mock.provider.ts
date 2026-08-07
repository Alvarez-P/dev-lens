import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Observable, EMPTY } from 'rxjs';

import { AIProvider } from '../domain/ai-provider.interface';
import {
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
  AIRequest,
  AIResponse,
} from '../domain/ai-request.vo';
import { ProviderUnavailableError } from '../domain/ai-errors';

/**
 * Deterministic provider for CI: fixtures keyed by `capability` +
 * `manifestSha256` on the filesystem. No network, no keys (REQ-AP-003).
 */
@Injectable()
export class MockProvider implements AIProvider {
  private readonly logger = new Logger(MockProvider.name);

  constructor(
    @Optional() private readonly fixturesDir: string = path.resolve(__dirname, '..', 'ai.fixtures'),
  ) {}

  async complete(_req: AIRequest): Promise<AIResponse> {
    return {
      content: 'mock response',
      model: 'mock',
      tokensUsed: { input: 0, output: 0 },
      finishReason: 'stop',
    };
  }

  streamComplete(_req: AIRequest): Observable<AIChunk> {
    // MVP deferred — interface present (REQ-AP-001).
    return EMPTY;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  estimateCost(_req: AIRequest): number {
    return 0;
  }

  async enrich(req: AIEnrichmentRequest): Promise<AIEnrichmentResponse> {
    const fixturePath = this.fixturePath(req.capability, req.manifestSha256);

    if (!fs.existsSync(fixturePath)) {
      this.logger.warn(`Mock fixture not found: ${fixturePath}`);
      throw new ProviderUnavailableError(
        'mock',
        req.model ?? 'mock',
        `No mock fixture for capability "${req.capability}" and sha256 "${req.manifestSha256}"`,
      );
    }

    const raw = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = JSON.parse(raw) as AIEnrichmentResponse;

    return parsed;
  }

  private fixturePath(capability: string, manifestSha256: string): string {
    return path.join(this.fixturesDir, capability, `${manifestSha256}.response.json`);
  }
}
