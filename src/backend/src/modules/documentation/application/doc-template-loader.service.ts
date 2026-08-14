import { Injectable, Optional } from '@nestjs/common';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { DocTemplate, DocTemplateParseError, parseDocTemplate } from '../domain/doc-template';

/** Default location: src/modules/documentation/templates (spec R6). */
const DEFAULT_BASE_DIR = join(process.cwd(), 'src', 'modules', 'documentation', 'templates');

const VERSION_DIR_PATTERN = /^v(\d+)$/;
const TEMPLATE_FILE = 'template.yml';

/**
 * Loads documentation templates from a versioned directory structure
 * (documentation-template-system R6):
 *
 *   templates/{type}/v{n}/template.yml
 *
 * Scans the whole templates tree at module initialization and parses every
 * template into a DocTemplate value object. Corrupt or malformed files throw
 * (fail-fast, R6) — initialization must never silently skip a broken template.
 * Mirrors PromptTemplateLoader (ai/application/prompt-template-loader.service.ts).
 */
@Injectable()
export class DocTemplateLoaderService {
  constructor(@Optional() public readonly baseDir: string = DEFAULT_BASE_DIR) {}

  /** Loads and parses every `{type}/v{n}/template.yml` found under the base dir. */
  loadAll(): DocTemplate[] {
    if (!existsSync(this.baseDir)) {
      throw new Error(`Documentation templates directory not found: ${this.baseDir}`);
    }

    const templates: DocTemplate[] = [];
    for (const typeDir of readdirSync(this.baseDir)) {
      const typePath = join(this.baseDir, typeDir);
      if (!statSync(typePath).isDirectory()) {
        continue;
      }

      for (const entry of readdirSync(typePath)) {
        if (!VERSION_DIR_PATTERN.test(entry)) {
          continue;
        }
        templates.push(this.loadTemplate(typeDir, typePath, entry));
      }
    }
    return templates;
  }

  private loadTemplate(typeDir: string, typePath: string, versionDir: string): DocTemplate {
    const templatePath = join(typePath, versionDir, TEMPLATE_FILE);

    if (!existsSync(templatePath)) {
      throw new DocTemplateParseError(
        `Template directory ${join(typePath, versionDir)} is missing ${TEMPLATE_FILE}`,
        join(typePath, versionDir),
      );
    }

    const template = parseDocTemplate(readFileSync(templatePath, 'utf8'), templatePath);

    if (template.id !== typeDir) {
      throw new DocTemplateParseError(
        `Template id '${template.id}' does not match its type directory '${typeDir}'`,
        templatePath,
      );
    }

    return template;
  }
}
