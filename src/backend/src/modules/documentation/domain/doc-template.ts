import { parse as parseYaml, YAMLParseError } from 'yaml';

/**
 * Section-level render formats (documentation-template-system R3). These are
 * Markdown *fragments* produced inside MarkdownRenderer — distinct from the
 * document-level DocFormat registry keys (design decision: two-layer rendering).
 */
export enum SectionFormat {
  TABLE = 'table',
  LIST = 'list',
  MERMAID_CLASS_DIAGRAM = 'mermaid-class-diagram',
  MERMAID_FLOWCHART = 'mermaid-flowchart',
  PLANTUML = 'plantuml',
  MARKDOWN = 'markdown',
  JSON = 'json',
}

/** One section declaration inside a template (template R1). */
export interface DocTemplateSection {
  id: string;
  title: string;
  /** Source function expression, e.g. `graph.exports("my-module")`. */
  source: string;
  /** SectionFormat value; unrecognized values are skipped with a warning (R3). */
  format: string;
  /** Optional conditional expression, e.g. `has_events` (R4). */
  condition?: string;
}

/** Parsed YAML template value object (template R1). */
export interface DocTemplate {
  id: string;
  name: string;
  version: number;
  sections: DocTemplateSection[];
  /** Filesystem path the template was loaded from — used in parse errors. */
  sourcePath: string;
}

/** Raised when a template file cannot be parsed or fails validation (R1/R6). */
export class DocTemplateParseError extends Error {
  constructor(
    message: string,
    public readonly sourcePath: string,
  ) {
    super(message);
    this.name = 'DocTemplateParseError';
  }
}

/** Raised when template resolution misses the requested (type, version) (R5). */
export class DocTemplateNotFoundError extends Error {
  constructor(
    public readonly docType: string,
    version?: number,
  ) {
    super(
      `Doc template not found for type '${docType}'` +
        (version !== undefined ? ` version ${version}` : ''),
    );
    this.name = 'DocTemplateNotFoundError';
  }
}

/** Raised when two templates register under the same (type, version) key (R5). */
export class DuplicateDocTemplateError extends Error {
  constructor(
    public readonly docType: string,
    public readonly version: number,
  ) {
    super(`Doc template already registered for type '${docType}' version ${version}`);
    this.name = 'DuplicateDocTemplateError';
  }
}

const REQUIRED_TEMPLATE_FIELDS = ['id', 'name', 'version', 'sections'] as const;
const REQUIRED_SECTION_FIELDS = ['id', 'title', 'source', 'format'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses a template.yml document into a DocTemplate value object. Fails fast
 * (corrupt-file fail-fast, R6): missing required fields or invalid YAML throw
 * a DocTemplateParseError whose message identifies the field and the path.
 */
export function parseDocTemplate(yamlText: string, sourcePath: string): DocTemplate {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      throw new DocTemplateParseError(
        `Invalid YAML in template ${sourcePath}: ${error.message}`,
        sourcePath,
      );
    }
    throw error;
  }

  if (!isRecord(raw)) {
    throw new DocTemplateParseError(
      `Template ${sourcePath} must be a YAML object with id, name, version, sections`,
      sourcePath,
    );
  }

  for (const field of REQUIRED_TEMPLATE_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) {
      throw new DocTemplateParseError(
        `Template ${sourcePath} is missing required field: ${field}`,
        sourcePath,
      );
    }
  }

  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version)) {
    throw new DocTemplateParseError(
      `Template ${sourcePath} field "version" must be an integer, got: ${String(raw.version)}`,
      sourcePath,
    );
  }

  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    throw new DocTemplateParseError(
      `Template ${sourcePath} fields "id" and "name" must be strings`,
      sourcePath,
    );
  }

  if (!Array.isArray(raw.sections)) {
    throw new DocTemplateParseError(
      `Template ${sourcePath} field "sections" must be an array`,
      sourcePath,
    );
  }

  const sections = raw.sections.map((section, index) => parseSection(section, index, sourcePath));

  return { id: raw.id, name: raw.name, version: raw.version, sections, sourcePath };
}

function parseSection(section: unknown, index: number, sourcePath: string): DocTemplateSection {
  if (!isRecord(section)) {
    throw new DocTemplateParseError(
      `Template ${sourcePath} sections[${index}] must be an object`,
      sourcePath,
    );
  }

  for (const field of REQUIRED_SECTION_FIELDS) {
    if (section[field] === undefined || section[field] === null) {
      throw new DocTemplateParseError(
        `Template ${sourcePath} sections[${index}] is missing required field: ${field}`,
        sourcePath,
      );
    }
  }

  const { id, title, source, format, condition } = section;
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof source !== 'string' ||
    typeof format !== 'string'
  ) {
    throw new DocTemplateParseError(
      `Template ${sourcePath} sections[${index}] fields id, title, source, format must be strings`,
      sourcePath,
    );
  }

  const parsed: DocTemplateSection = { id, title, source, format };
  if (typeof condition === 'string') {
    parsed.condition = condition;
  }
  return parsed;
}
