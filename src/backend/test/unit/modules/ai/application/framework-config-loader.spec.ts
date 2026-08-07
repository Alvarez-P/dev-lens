import { Logger } from '@nestjs/common';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  FrameworkConfigLoader,
  FrameworkConfig,
  GENERIC_FRAMEWORK_CONFIG,
} from '@/modules/ai/application/framework-config-loader.service';

/**
 * Task 4.7 (REQ-PM-006): framework-specific format configuration from
 * `ai/frameworks/{framework}.json`. Unknown frameworks fall back to a generic
 * config with a warning.
 */
describe('FrameworkConfigLoader (REQ-PM-006)', () => {
  let baseDir: string;
  let loader: FrameworkConfigLoader;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'ai-frameworks-'));
    loader = new FrameworkConfigLoader(baseDir);
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  function writeFramework(name: string, config: FrameworkConfig) {
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, `${name}.json`), JSON.stringify(config));
  }

  describe('loading a known framework', () => {
    it('should load the framework config with all required fields', () => {
      writeFramework('nestjs', {
        name: 'nestjs',
        description: 'NestJS modular framework',
        decoratorSemantics: { '@Controller': 'route controller' },
        lifecycleStageOrder: ['guard', 'interceptor', 'pipe', 'handler'],
        entryPointPatterns: ['**/*.controller.ts'],
      });

      const config = loader.load('nestjs');

      expect(config.name).toBe('nestjs');
      expect(config.decoratorSemantics['@Controller']).toBe('route controller');
      expect(config.lifecycleStageOrder).toEqual(['guard', 'interceptor', 'pipe', 'handler']);
      expect(config.entryPointPatterns).toEqual(['**/*.controller.ts']);
    });
  });

  describe('generic fallback', () => {
    it('should fall back to the generic config for unknown frameworks', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        const config = loader.load('custom-framework');

        expect(config).toEqual(GENERIC_FRAMEWORK_CONFIG);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("No framework config for 'custom-framework'"),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should expose a generic config with no decorator semantics', () => {
      expect(GENERIC_FRAMEWORK_CONFIG.name).toBe('unknown');
      expect(GENERIC_FRAMEWORK_CONFIG.decoratorSemantics).toEqual({});
      expect(GENERIC_FRAMEWORK_CONFIG.lifecycleStageOrder).toEqual([]);
      expect(GENERIC_FRAMEWORK_CONFIG.entryPointPatterns).toEqual([]);
    });
  });

  describe('default base directory', () => {
    it('should default to the ai.frameworks directory next to the module', () => {
      const defaultLoader = new FrameworkConfigLoader();

      expect(defaultLoader.baseDir).toMatch(/ai\.frameworks$/);
    });
  });
});
