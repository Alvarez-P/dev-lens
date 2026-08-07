import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PromptTemplateLoader } from '@/modules/ai/application/prompt-template-loader.service';

/**
 * Task 4.5 (REQ-PM-001): versioned template loading from
 * `ai/capabilities/{capabilityId}/v{n}/system.md | instructions.md | examples.json`.
 * Highest version ≤ requested; latest when none specified; missing version
 * errors early with capability id + requested version.
 */
describe('PromptTemplateLoader (REQ-PM-001)', () => {
  let baseDir: string;
  let loader: PromptTemplateLoader;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'ai-capabilities-'));
    loader = new PromptTemplateLoader(baseDir);
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  function writeTemplate(
    version: number,
    files: { system?: string; instructions?: string; examples?: string },
  ) {
    const dir = join(baseDir, 'classify-lifecycle', `v${version}`);
    mkdirSync(dir, { recursive: true });

    if (files.system !== undefined) {
      writeFileSync(join(dir, 'system.md'), files.system);
    }

    if (files.instructions !== undefined) {
      writeFileSync(join(dir, 'instructions.md'), files.instructions);
    }

    if (files.examples !== undefined) {
      writeFileSync(join(dir, 'examples.json'), files.examples);
    }
  }

  describe('version selection', () => {
    it('should load the requested version when it exists', () => {
      writeTemplate(1, {
        system: 'You are a classifier (v1).',
        instructions: 'Classify classes.',
      });
      writeTemplate(2, {
        system: 'You are a classifier (v2).',
        instructions: 'Classify classes carefully.',
      });

      const templates = loader.load('classify-lifecycle', 1);

      expect(templates.version).toBe(1);
      expect(templates.system).toBe('You are a classifier (v1).');
      expect(templates.instructions).toBe('Classify classes.');
    });

    it('should select the highest version ≤ the requested version', () => {
      writeTemplate(1, { system: 'v1', instructions: 'i1' });
      writeTemplate(2, { system: 'v2', instructions: 'i2' });
      writeTemplate(3, { system: 'v3', instructions: 'i3' });

      const templates = loader.load('classify-lifecycle', 2);

      expect(templates.version).toBe(2);
      expect(templates.system).toBe('v2');
    });

    it('should load the latest version when none is specified', () => {
      writeTemplate(1, { system: 'v1', instructions: 'i1' });
      writeTemplate(2, { system: 'v2', instructions: 'i2' });
      writeTemplate(3, { system: 'v3', instructions: 'i3' });

      const templates = loader.load('classify-lifecycle');

      expect(templates.version).toBe(3);
      expect(templates.system).toBe('v3');
    });

    it('should error when the requested version does not exist even if lower versions do', () => {
      writeTemplate(1, { system: 'v1', instructions: 'i1' });
      writeTemplate(5, { system: 'v5', instructions: 'i5' });

      expect(() => loader.load('classify-lifecycle', 3)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/classify-lifecycle/),
        }),
      );
      expect(() => loader.load('classify-lifecycle', 3)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/version 3/),
        }),
      );
    });
  });

  describe('missing template handling', () => {
    it('should throw when the requested version does not exist', () => {
      writeTemplate(1, { system: 'v1', instructions: 'i1' });

      expect(() => loader.load('classify-lifecycle', 5)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/classify-lifecycle/),
        }),
      );
      expect(() => loader.load('classify-lifecycle', 5)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/version 5/),
        }),
      );
    });

    it('should throw when the capability has no versions at all', () => {
      expect(() => loader.load('unknown-capability')).toThrow(/unknown-capability/);
    });
  });

  describe('examples', () => {
    it('should load examples.json when present', () => {
      writeTemplate(1, {
        system: 's',
        instructions: 'i',
        examples: JSON.stringify({ examples: [{ input: 'x', output: 'y' }] }),
      });

      const templates = loader.load('classify-lifecycle', 1);

      expect(templates.examples).toEqual({ examples: [{ input: 'x', output: 'y' }] });
    });

    it('should leave examples null when absent', () => {
      writeTemplate(1, { system: 's', instructions: 'i' });

      const templates = loader.load('classify-lifecycle', 1);

      expect(templates.examples).toBeNull();
    });
  });

  describe('filesystem loading at build time (REQ-PM-001)', () => {
    it('should load templates from the filesystem, not bundle them', () => {
      writeTemplate(1, { system: 'from disk', instructions: 'instructions from disk' });

      const templates = loader.load('classify-lifecycle', 1);

      expect(templates.system).toBe('from disk');
      expect(templates.instructions).toBe('instructions from disk');
    });

    it('should expose the resolved base directory for framework config lookup', () => {
      expect(loader.baseDir).toBe(baseDir);
    });
  });
});
