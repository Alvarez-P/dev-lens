import { Injectable, Logger, Optional } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

/** Default location relative to the AI module: src/modules/ai/ai.frameworks. */
const DEFAULT_BASE_DIR = resolve(__dirname, '..', 'ai.frameworks');

export interface FrameworkConfig {
  name: string;
  description: string;
  /** Decorator name → role/meaning, informs classification vocabulary (REQ-PM-006). */
  decoratorSemantics: Record<string, string>;
  /** Canonical lifecycle stage order for the framework. */
  lifecycleStageOrder: string[];
  /** Glob patterns identifying controller/entry-point files. */
  entryPointPatterns: string[];
}

/** Fallback for unknown frameworks — reduced classification confidence (REQ-PM-006). */
export const GENERIC_FRAMEWORK_CONFIG: FrameworkConfig = {
  name: 'unknown',
  description: 'Unknown framework — classification uses generic naming heuristics only.',
  decoratorSemantics: {},
  lifecycleStageOrder: [],
  entryPointPatterns: [],
};

/**
 * Loads framework-specific format configuration from `ai/frameworks/{framework}.json`
 * (REQ-PM-006). Informs the LLM about framework semantics without hardcoding
 * decorator names in code. Missing configs fall back to a generic format with a
 * warning.
 */
@Injectable()
export class FrameworkConfigLoader {
  private readonly logger = new Logger(FrameworkConfigLoader.name);

  constructor(@Optional() public readonly baseDir: string = DEFAULT_BASE_DIR) {}

  load(framework: string): FrameworkConfig {
    const configPath = join(this.baseDir, `${framework}.json`);

    if (!existsSync(configPath)) {
      this.logger.warn(`No framework config for '${framework}', using generic`);

      return GENERIC_FRAMEWORK_CONFIG;
    }

    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<FrameworkConfig>;

    return {
      name: raw.name ?? framework,
      description: raw.description ?? '',
      decoratorSemantics: raw.decoratorSemantics ?? {},
      lifecycleStageOrder: raw.lifecycleStageOrder ?? [],
      entryPointPatterns: raw.entryPointPatterns ?? [],
    };
  }
}
