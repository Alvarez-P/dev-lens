import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { ManifestFrameworkDetector } from '@/modules/analysis/application/manifest-framework-detector';

describe('ManifestFrameworkDetector', () => {
  let detector: ManifestFrameworkDetector;
  let repoPath: string;

  beforeEach(() => {
    detector = new ManifestFrameworkDetector();
    repoPath = mkdtempSync(join(tmpdir(), 'devlens-detector-'));
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
  });

  describe('detect', () => {
    it('should return a nestjs candidate when package.json declares @nestjs/core', () => {
      writeFileSync(
        join(repoPath, 'package.json'),
        JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } }),
      );

      const candidates = detector.detect(repoPath);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].framework).toBe('nestjs');
      expect(candidates[0].file).toBe('package.json');
      expect(candidates[0].markers).toEqual(['@nestjs/core']);
    });

    it('should return no candidates when no manifest exists', () => {
      const candidates = detector.detect(repoPath);

      expect(candidates).toEqual([]);
    });

    it('should return an express candidate when package.json declares express', () => {
      writeFileSync(
        join(repoPath, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.19.0' } }),
      );

      const candidates = detector.detect(repoPath);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].framework).toBe('express');
    });

    it('should return no candidates when package.json declares no known markers', () => {
      writeFileSync(
        join(repoPath, 'package.json'),
        JSON.stringify({ dependencies: { lodash: '^4.17.0' } }),
      );

      const candidates = detector.detect(repoPath);

      expect(candidates).toEqual([]);
    });

    it('should match markers in devDependencies as well', () => {
      writeFileSync(
        join(repoPath, 'package.json'),
        JSON.stringify({ devDependencies: { '@nestjs/core': '^10.0.0' } }),
      );

      const candidates = detector.detect(repoPath);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].framework).toBe('nestjs');
    });

    it('should ignore a package.json with invalid JSON', () => {
      writeFileSync(join(repoPath, 'package.json'), '{ not valid json');

      const candidates = detector.detect(repoPath);

      expect(candidates).toEqual([]);
    });
  });
});
