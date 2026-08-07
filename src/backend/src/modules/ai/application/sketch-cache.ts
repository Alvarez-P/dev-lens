import { Injectable } from '@nestjs/common';
import { CodeSketch } from '../domain/code-sketch.vo';

/** Content-addressed cache key prefix (REQ-CA-006). */
export const SKETCH_CACHE_PREFIX = 'ai:sketch:';

export function sketchCacheKey(sha256: string): string {
  return `${SKETCH_CACHE_PREFIX}${sha256}`;
}

/**
 * In-memory content-addressed sketch cache (REQ-CA-006).
 *
 * Redis is the design target per RFC-009 but the design defers Redis to a
 * later milestone — an in-memory Map keeps the MVP dependency-free while
 * preserving the content-addressed key scheme (`ai:sketch:{sha256}`). Sketch
 * computation is a pure function of file content: same sha256 → same sketch.
 */
@Injectable()
export class SketchCache {
  private readonly store = new Map<string, CodeSketch>();

  get(key: string): CodeSketch | undefined {
    return this.store.get(key);
  }

  set(key: string, sketch: CodeSketch): void {
    this.store.set(key, sketch);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}
