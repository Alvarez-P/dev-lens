import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

import {
  FileManifestService,
  FileDiff,
} from '@/modules/analysis/application/file-manifest.service';

describe('FileManifestService', () => {
  let service: FileManifestService;
  let repoPath: string;

  function write(repoRelativePath: string, content: string): string {
    const absolutePath = join(repoPath, repoRelativePath);
    mkdirSync(join(absolutePath, '..'), { recursive: true });
    writeFileSync(absolutePath, content);

    return absolutePath;
  }

  function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  beforeEach(() => {
    service = new FileManifestService();
    repoPath = mkdtempSync(join(tmpdir(), 'devlens-manifest-'));
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
  });

  describe('computeManifest', () => {
    it('should hash every source file under the repo with SHA-256 keyed by repo-relative path', () => {
      write('src/a.ts', 'export const a = 1;');
      write('src/b.ts', 'export const b = 2;');
      write('src/c.ts', 'export const c = 3;');

      const manifest = service.computeManifest(repoPath);

      expect(Object.keys(manifest)).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
      expect(manifest['src/a.ts']).toBe(sha256('export const a = 1;'));
      expect(manifest['src/a.ts']).toHaveLength(64);
      expect(manifest['src/b.ts']).toBe(sha256('export const b = 2;'));
    });

    it('should filter files by the provided extensions', () => {
      write('src/a.ts', 'export const a = 1;');
      write('src/b.js', 'export const b = 2;');

      const manifest = service.computeManifest(repoPath, ['.ts']);

      expect(Object.keys(manifest)).toEqual(['src/a.ts']);
    });

    it('should skip ignored directories (node_modules, .git, dist, build, coverage)', () => {
      write('src/a.ts', 'export const a = 1;');
      write('node_modules/dep.ts', 'export const dep = 1;');
      write('.git/hooks/x.ts', 'export const hook = 1;');
      write('dist/out.ts', 'export const out = 1;');
      write('build/out.ts', 'export const build = 1;');
      write('coverage/lcov.ts', 'export const cov = 1;');

      const manifest = service.computeManifest(repoPath);

      expect(Object.keys(manifest)).toEqual(['src/a.ts']);
    });

    it('should return an empty manifest for an empty repo', () => {
      expect(service.computeManifest(repoPath)).toEqual({});
    });
  });

  describe('diffManifests', () => {
    it('should classify unchanged files by equal hashes', () => {
      const previous = { 'src/a.ts': 'AAA' };
      const current = { 'src/a.ts': 'AAA' };

      expect(service.diffManifests(current, previous)).toEqual({
        added: [],
        modified: [],
        deleted: [],
        unchanged: ['src/a.ts'],
      });
    });

    it('should classify a changed hash as modified', () => {
      const previous = { 'src/a.ts': 'AAA' };
      const current = { 'src/a.ts': 'BBB' };

      expect(service.diffManifests(current, previous)).toEqual({
        added: [],
        modified: ['src/a.ts'],
        deleted: [],
        unchanged: [],
      });
    });

    it('should classify new keys as added', () => {
      const previous = { 'src/a.ts': 'AAA' };
      const current = { 'src/a.ts': 'AAA', 'src/b.ts': 'BBB' };

      expect(service.diffManifests(current, previous)).toEqual({
        added: ['src/b.ts'],
        modified: [],
        deleted: [],
        unchanged: ['src/a.ts'],
      });
    });

    it('should classify keys missing from the new manifest as deleted', () => {
      const previous = { 'src/a.ts': 'AAA', 'src/b.ts': 'BBB' };
      const current = { 'src/a.ts': 'AAA' };

      expect(service.diffManifests(current, previous)).toEqual({
        added: [],
        modified: [],
        deleted: ['src/b.ts'],
        unchanged: ['src/a.ts'],
      });
    });
  });

  describe('shouldFullReparse', () => {
    const diff: FileDiff = { added: [], modified: [], deleted: [], unchanged: [] };

    it('should return false when the changed ratio is at or below the default threshold', () => {
      const partial: FileDiff = {
        added: ['b.ts'],
        modified: [],
        deleted: [],
        unchanged: ['a.ts', 'c.ts'],
      };

      expect(service.shouldFullReparse(partial, 3)).toBe(false); // 1/3 < 0.5
      expect(service.shouldFullReparse({ ...diff, deleted: ['c.ts'] }, 2)).toBe(false); // 1/2 = 0.5
    });

    it('should return true when the changed ratio exceeds the default threshold', () => {
      const mostlyChanged: FileDiff = {
        added: ['b.ts'],
        modified: ['c.ts'],
        deleted: [],
        unchanged: ['a.ts'],
      };

      expect(service.shouldFullReparse(mostlyChanged, 3)).toBe(true); // 2/3 > 0.5
    });

    it('should honour a custom threshold', () => {
      const diffWithThreeChanged: FileDiff = {
        added: ['b.ts'],
        modified: ['c.ts'],
        deleted: ['d.ts'],
        unchanged: ['a.ts'],
      };

      expect(service.shouldFullReparse(diffWithThreeChanged, 10, 0.4)).toBe(false); // 3/10 < 0.4
      expect(service.shouldFullReparse(diffWithThreeChanged, 4, 0.4)).toBe(true); // 3/4 = 0.75 > 0.4
    });

    it('should return true when there are no files to compare', () => {
      expect(service.shouldFullReparse(diff, 0)).toBe(true);
    });
  });
});
