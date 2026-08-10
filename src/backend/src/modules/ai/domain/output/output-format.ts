import type { ClassConstructor } from 'class-transformer';

/** Supported AI response formats (spec R3). */
export type OutputFormatType = 'text' | 'markdown' | 'json';

/**
 * Expected structure of AI responses (spec R3). JSON formats SHALL specify
 * the `dto` class so generated responses can be validated post-hoc with
 * class-validator; failures surface as `AIDidNotMeetSchemaError`. JSONSchema /
 * ajv support and the `mermaid` format are deferred (RFC-010 §5.4).
 */
export interface OutputFormat {
  type: OutputFormatType;
  /** Required when `type` is `json`. */
  dto?: ClassConstructor<object>;
  /** markdown only: render an optional YAML frontmatter block. */
  frontmatter?: boolean;
}

export interface OutputFormatInput {
  type: OutputFormatType;
  /** Required when `type` is `json`. */
  dto?: ClassConstructor<object>;
  /** markdown only: render an optional YAML frontmatter block. */
  frontmatter?: boolean;
}

/**
 * Builds an immutable OutputFormat value object, enforcing that JSON formats
 * always carry a DTO for post-generation validation (spec R3).
 */
export function createOutputFormat(input: OutputFormatInput): OutputFormat {
  if (input.type === 'json' && input.dto === undefined) {
    throw new Error('OutputFormat type "json" requires a dto class for validation');
  }

  const format: OutputFormat = { type: input.type };

  if (input.dto !== undefined) {
    format.dto = input.dto;
  }

  if (input.frontmatter !== undefined) {
    format.frontmatter = input.frontmatter;
  }

  return Object.freeze(format);
}
