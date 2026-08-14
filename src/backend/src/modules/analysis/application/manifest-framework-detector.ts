import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { FrameworkCandidate } from '../domain/framework-candidate.vo';

/**
 * Deterministic marker map (ADR-2): package.json only, non-TS manifests deferred.
 * Marker name → framework id. Adding a framework here requires no AI-module changes.
 */
export const PACKAGE_JSON_FRAMEWORK_MARKERS: ReadonlyMap<string, readonly string[]> = new Map([
  ['nestjs', ['@nestjs/core']],
  ['express', ['express']],
]);

export const PACKAGE_JSON_MANIFEST_FILE = 'package.json';

@Injectable()
export class ManifestFrameworkDetector {
  detect(repoPath: string): FrameworkCandidate[] {
    const manifestPath = join(repoPath, PACKAGE_JSON_MANIFEST_FILE);

    if (!existsSync(manifestPath)) {
      return [];
    }

    let manifest: unknown;

    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
    } catch {
      return [];
    }

    const dependencies = this.collectDependencies(manifest);

    if (dependencies.length === 0) {
      return [];
    }

    const candidates: FrameworkCandidate[] = [];

    for (const [framework, markers] of PACKAGE_JSON_FRAMEWORK_MARKERS) {
      const matched = markers.filter((marker) => dependencies.includes(marker));

      if (matched.length > 0) {
        candidates.push(
          FrameworkCandidate.create({
            framework,
            file: PACKAGE_JSON_MANIFEST_FILE,
            markers: matched,
          }),
        );
      }
    }

    return candidates;
  }

  private collectDependencies(manifest: unknown): string[] {
    if (typeof manifest !== 'object' || manifest === null) {
      return [];
    }

    const record = manifest as Record<string, unknown>;
    const sections = [record['dependencies'], record['devDependencies']];
    const names: string[] = [];

    for (const section of sections) {
      if (typeof section !== 'object' || section === null) {
        continue;
      }

      names.push(...Object.keys(section as Record<string, unknown>));
    }

    return names;
  }
}
