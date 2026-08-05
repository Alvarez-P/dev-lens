import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

export const SOURCE_EXTENSIONS: ReadonlyArray<string> = ['.ts', '.tsx', '.js', '.jsx'];

export const IGNORED_DIRECTORIES: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'out',
]);

export interface FileDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

@Injectable()
export class FileManifestService {
  computeManifest(
    repoPath: string,
    extensions: ReadonlyArray<string> = SOURCE_EXTENSIONS,
  ): Record<string, string> {
    const extensionSet = new Set(extensions.map((extension) => extension.toLowerCase()));
    const manifest: Record<string, string> = {};
    const entries = readdirSync(repoPath, { recursive: true, withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const absolutePath = join(entry.parentPath, entry.name);
      const segments = absolutePath.split(/[\\/]+/);

      if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) {
        continue;
      }

      if (!extensionSet.has(this.extensionOf(absolutePath))) {
        continue;
      }

      try {
        const content = readFileSync(absolutePath, 'utf8');
        manifest[relative(repoPath, absolutePath)] = createHash('sha256')
          .update(content)
          .digest('hex');
      } catch {
        void 0;
      }
    }

    return manifest;
  }

  diffManifests(
    newManifest: Record<string, string>,
    previousManifest: Record<string, string>,
  ): FileDiff {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const unchanged: string[] = [];

    for (const [filePath, hash] of Object.entries(newManifest)) {
      const previousHash = previousManifest[filePath];

      if (previousHash === undefined) {
        added.push(filePath);
      } else if (previousHash === hash) {
        unchanged.push(filePath);
      } else {
        modified.push(filePath);
      }
    }

    for (const filePath of Object.keys(previousManifest)) {
      if (newManifest[filePath] === undefined) {
        deleted.push(filePath);
      }
    }

    return { added, modified, deleted, unchanged };
  }

  shouldFullReparse(diff: FileDiff, totalFiles: number, threshold: number = 0.5): boolean {
    if (totalFiles <= 0) {
      return true;
    }

    const changed = diff.added.length + diff.modified.length + diff.deleted.length;

    return changed / totalFiles > threshold;
  }

  private extensionOf(filePath: string): string {
    const dotIndex = filePath.lastIndexOf('.');

    return dotIndex < 0 ? '' : filePath.slice(dotIndex).toLowerCase();
  }
}
