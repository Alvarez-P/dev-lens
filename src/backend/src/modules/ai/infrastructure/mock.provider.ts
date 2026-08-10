import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs';

import { AIProvider } from '../domain/ai-provider.interface';
import {
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
  AIRequest,
  AIResponse,
} from '../domain/ai-request.vo';
import { ProviderUnavailableError } from '../domain/ai-errors';
import { AIProviderConfig } from '@/config/configuration';

const DEFAULT_MODEL = 'mock';
const DEFAULT_FIXTURES_DIR = path.resolve(__dirname, '..', 'ai.fixtures');

/** Stable capability-id → canned response used when no fixture exists. */
const CAPABILITY_RESPONSES: Record<string, string> = {
  'classify-lifecycle': 'mock: classified 2 classes with 2 lifecycle stages',
  'explain-module': 'mock: explains module structure, dependencies, and API surface',
  default: 'mock response',
};

/** Deterministic pseudo-random generator (mulberry32) — same seed → same sequence. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic provider for CI: fixture-backed enrichments keyed by
 * `capability` + `manifestSha256` on the filesystem; streaming emits a
 * canned response keyed by capability, tokenized deterministically from a
 * request-derived seed. No network, no keys (REQ-AP-005 / ai-provider
 * R5 — CI uses the mock exclusively).
 */
@Injectable()
export class MockProvider implements AIProvider {
  readonly id = 'mock';
  readonly name = 'Mock Provider';
  readonly supportedModels: string[];

  private readonly logger = new Logger(MockProvider.name);
  private readonly model: string;
  private readonly fixturesDir: string;

  constructor(config: AIProviderConfig | undefined, fixturesDir: string = DEFAULT_FIXTURES_DIR) {
    this.model = config?.defaultModel ?? DEFAULT_MODEL;
    this.supportedModels = [this.model];
    this.fixturesDir = fixturesDir;
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const content = this.responseFor(req);

    return {
      content,
      model: this.model,
      tokensUsed: { input: 0, output: 0 },
      finishReason: 'stop',
    };
  }

  /**
   * Stream the canned response for the requested capability as deterministic
   * token chunks (ai-streaming R2 chunk contract). Token boundaries are
   * derived from a seeded PRNG keyed on the request, so the same request
   * always yields the same stream (REQ-AP-005 golden-fixture determinism).
   * Never touches the network.
   */
  streamComplete(req: AIRequest): Observable<AIChunk> {
    return new Observable<AIChunk>((subscriber) => {
      const content = this.responseFor(req);
      const tokens = this.tokenize(content, req);

      tokens.forEach((token) => subscriber.next({ type: 'token', content: token }));

      subscriber.next({
        type: 'done',
        content: '',
        tokens: tokens.length,
        model: this.model,
      });
      subscriber.complete();
    });
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
        req.model ?? this.model,
        `No mock fixture for capability "${req.capability}" and sha256 "${req.manifestSha256}"`,
      );
    }

    const raw = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = JSON.parse(raw) as AIEnrichmentResponse;

    return parsed;
  }

  private responseFor(req: AIRequest): string {
    const capability = this.capabilityFrom(req);

    return CAPABILITY_RESPONSES[capability] ?? CAPABILITY_RESPONSES.default;
  }

  /**
   * The mock has no network to interrogate, so the capability key is derived
   * from the request: an explicit `capability` in an enrichment-style request
   * wins; otherwise the last user message is used as the seed.
   */
  private capabilityFrom(req: AIRequest): string {
    const asEnrichment = req as AIEnrichmentRequest;

    if (typeof asEnrichment.capability === 'string' && asEnrichment.capability.length > 0) {
      return asEnrichment.capability;
    }

    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');

    return lastUser?.content ?? 'default';
  }

  /**
   * Split the canned response into word tokens, deterministically shuffled by
   * the request seed. The same request always yields the same token order;
   * a different request (even for the same capability) yields a different
   * order — this is the "capability + seed" keying (REQ-AP-005).
   */
  private tokenize(content: string, req: AIRequest): string[] {
    const words = content.split(/\s+/).filter(Boolean);
    const rand = seededRandom(this.seedFrom(req));

    // Deterministic Fisher–Yates shuffle driven by the seeded PRNG.
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }

    return words;
  }

  private seedFrom(req: AIRequest): number {
    // Stable string hash (djb2) over the joined message contents so that
    // different requests — even equal-length ones — yield different seeds.
    const input = req.messages.map((m) => `${m.role}:${m.content}`).join('|');
    let hash = 5381;

    for (let i = 0; i < input.length; i++) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }

    return hash >>> 0;
  }

  private fixturePath(capability: string, manifestSha256: string): string {
    return path.join(this.fixturesDir, capability, `${manifestSha256}.response.json`);
  }
}
