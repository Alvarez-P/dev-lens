import { Injectable } from '@nestjs/common';

import {
  DocTemplate,
  DocTemplateNotFoundError,
  DocTemplateSection,
  DuplicateDocTemplateError,
} from '../domain/doc-template';
import { DocType } from '../domain/doc-type.enum';

/** Registration scope (R5). Built-ins ship with the module; org custom
 *  templates are deferred to Phase 2 but the chain is structural from day one. */
export enum TemplateKind {
  BUILT_IN = 'built-in',
  CUSTOM = 'custom',
}

function templateKey(type: string, version: number): string {
  return `${type}@${version}`;
}

/**
 * R5: a Controller module selects module-docs + api-reference and merges
 * their sections into a single documentation artifact.
 */
export const CONTROLLER_MERGE_DOC_TYPES: readonly DocType[] = [
  DocType.MODULE_DOCS,
  DocType.API_REFERENCE,
];

/**
 * In-memory DocTemplateRegistry keyed by (type, version) — provided under the
 * DOC_TEMPLATE_REGISTRY token (documentation-template-system R5/R6). Resolution
 * follows the spec hierarchy: organization custom templates first, then the
 * built-in fallback. Mirrors CapabilityRegistryService
 * (ai/application/capability-registry.service.ts).
 */
@Injectable()
export class DocTemplateRegistryService {
  private readonly builtIn = new Map<string, DocTemplate>();
  private readonly custom = new Map<string, DocTemplate>();

  /** Registers a template under (id, version). Duplicates throw (R5). */
  register(template: DocTemplate, kind: TemplateKind = TemplateKind.BUILT_IN): void {
    const key = templateKey(template.id, template.version);
    const target = kind === TemplateKind.CUSTOM ? this.custom : this.builtIn;

    if (target.has(key)) {
      throw new DuplicateDocTemplateError(template.id, template.version);
    }
    target.set(key, template);
  }

  /**
   * Custom-first, built-in fallback resolution (R5). Without a version the
   * latest registered version for the type is returned; with a version only
   * the exact match counts.
   */
  resolve(type: string, version?: number): DocTemplate | null {
    return this.lookup(this.custom, type, version) ?? this.lookup(this.builtIn, type, version);
  }

  /** Resolve or throw DocTemplateNotFoundError (R5). */
  get(type: string, version?: number): DocTemplate {
    const template = this.resolve(type, version);
    if (!template) {
      throw new DocTemplateNotFoundError(type, version);
    }
    return template;
  }

  has(type: string, version?: number): boolean {
    return this.resolve(type, version) !== null;
  }

  list(): DocTemplate[] {
    return [...this.builtIn.values(), ...this.custom.values()];
  }

  /** Resolves each type and merges their sections (R5 controller merge). */
  merge(types: readonly DocType[]): DocTemplate {
    return mergeDocTemplates(types.map((type) => this.get(type)));
  }

  private lookup(
    map: Map<string, DocTemplate>,
    type: string,
    version?: number,
  ): DocTemplate | null {
    if (version !== undefined) {
      return map.get(templateKey(type, version)) ?? null;
    }

    let latest: DocTemplate | null = null;
    for (const template of map.values()) {
      if (template.id !== type) {
        continue;
      }
      if (latest === null || template.version > latest.version) {
        latest = template;
      }
    }
    return latest;
  }
}

/**
 * Merges multiple templates into one (R5: module-docs + api-reference for a
 * controller). The first template supplies the merged identity; sections are
 * concatenated in order and de-duplicated by id (first occurrence wins).
 */
export function mergeDocTemplates(templates: DocTemplate[]): DocTemplate {
  if (templates.length === 0) {
    throw new Error('Cannot merge an empty template list');
  }

  const seen = new Set<string>();
  const sections: DocTemplateSection[] = [];

  for (const template of templates) {
    for (const section of template.sections) {
      if (seen.has(section.id)) {
        continue;
      }
      seen.add(section.id);
      sections.push(section);
    }
  }

  const [head] = templates;
  return { ...head, sections };
}
