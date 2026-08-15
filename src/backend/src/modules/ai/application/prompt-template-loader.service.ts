import { Injectable, Optional } from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PromptExample } from '../domain/prompt-template';

export interface LoadedPromptTemplates {
  capabilityId: string;
  /** The resolved version directory, e.g. 2 for v2/. */
  version: number;
  system: string;
  instructions: string;
  /** Parsed examples.json mapped to PromptExample, or null when absent/empty. */
  examples: PromptExample[] | null;
}

/** Raw shape of examples.json entries before reconciliation to PromptExample. */
interface RawPromptExample {
  framework?: string;
  description?: string;
  output?: unknown;
}

/** Default location: src/modules/ai/ai.capabilities (relative to workspace root). */
const DEFAULT_BASE_DIR = join(process.cwd(), 'src', 'modules', 'ai', 'ai.capabilities');

const VERSION_DIR_PATTERN = /^v(\d+)$/;

/**
 * Loads prompt templates from a versioned directory structure (REQ-PM-001):
 *
 *   ai/capabilities/{capability-id}/v{n}/system.md
 *   ai/capabilities/{capability-id}/v{n}/instructions.md
 *   ai/capabilities/{capability-id}/v{n}/examples.json  (optional)
 *
 * Selects the highest version ≤ requested; when no version is requested the
 * latest is used. Templates are loaded from the filesystem at build time —
 * never bundled in code. A missing version errors early (before any LLM call)
 * with the capability id and requested version in the message.
 */
@Injectable()
export class PromptTemplateLoader {
  constructor(@Optional() public readonly baseDir: string = DEFAULT_BASE_DIR) {}

  load(capabilityId: string, version?: number): LoadedPromptTemplates {
    const capabilityDir = join(this.baseDir, capabilityId);

    if (!existsSync(capabilityDir)) {
      throw new Error(
        `Prompt template not found for capability '${capabilityId}'` +
          (version !== undefined ? ` version ${version}` : ''),
      );
    }

    const availableVersions = readdirSync(capabilityDir)
      .map((entry) => VERSION_DIR_PATTERN.exec(entry))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]));

    if (availableVersions.length === 0) {
      throw new Error(
        `Prompt template not found for capability '${capabilityId}'` +
          (version !== undefined ? ` version ${version}` : ''),
      );
    }

    const resolvedVersion = this.resolveVersion(availableVersions, version);

    if (resolvedVersion === null) {
      throw new Error(
        `Prompt template version ${version} not found for capability '${capabilityId}'`,
      );
    }

    const templateDir = join(capabilityDir, `v${resolvedVersion}`);
    const system = readFileSync(join(templateDir, 'system.md'), 'utf8');
    const instructions = readFileSync(join(templateDir, 'instructions.md'), 'utf8');
    const examples = this.readExamples(templateDir);

    return { capabilityId, version: resolvedVersion, system, instructions, examples };
  }

  /**
   * Resolve the version to load: the exact requested version when given (a
   * missing version errors early per REQ-PM-001), otherwise the highest
   * available version.
   */
  private resolveVersion(available: number[], requested?: number): number | null {
    if (requested === undefined) {
      return Math.max(...available);
    }

    return available.includes(requested) ? requested : null;
  }

  private readExamples(templateDir: string): PromptExample[] | null {
    const examplesPath = join(templateDir, 'examples.json');

    if (!existsSync(examplesPath)) {
      return null;
    }

    const raw = JSON.parse(readFileSync(examplesPath, 'utf8')) as {
      examples?: RawPromptExample[];
    } | null;

    if (raw === null || typeof raw !== 'object' || !Array.isArray(raw.examples)) {
      return null;
    }

    const entries = raw.examples;

    if (entries.length === 0) {
      return null;
    }

    // Reconcile the on-disk {framework, description, output} shape to the
    // domain PromptExample {input, output} shape (RFC-010 §5.3).
    return entries.map((entry) => {
      const framework = entry.framework?.trim() ?? '';
      const description = entry.description?.trim() ?? '';

      return {
        input: [framework, description].filter(Boolean).join(': '),
        output: entry.output === undefined ? '' : JSON.stringify(entry.output),
      };
    });
  }
}
