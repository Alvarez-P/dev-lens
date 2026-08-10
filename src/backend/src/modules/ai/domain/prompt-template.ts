/** Few-shot example (RFC-010 §5.3). */
export interface PromptExample {
  input: string;
  output: string;
}

/**
 * Separates prompt structure from execution logic (RFC-010 §5.3). The four
 * sections map 1:1 to the ai-prompt-management spec R3 prompt structure:
 * (1) System Instruction, (2) Knowledge Graph Context (inserted at the
 * `contextPlaceholder`), (3) User Query (wrapped by `userQueryWrapper`),
 * (4) Capability Instructions.
 *
 * Template versioning follows RFC-010 §8.3: the capability's own `version`
 * selects `ai/capabilities/{id}/v{n}/`, so the template carries no version.
 */
export interface PromptTemplate {
  /** System-level behavior instruction. */
  systemInstruction: string;
  /** Where the assembled context is inserted. */
  contextPlaceholder: string;
  /** How the user query is wrapped. */
  userQueryWrapper: string;
  /** Specific instructions for this capability. */
  capabilityInstructions: string;
  /** Few-shot examples (optional). */
  examples?: readonly PromptExample[];
}

export interface PromptTemplateInput {
  systemInstruction: string;
  contextPlaceholder: string;
  userQueryWrapper: string;
  capabilityInstructions: string;
  examples?: PromptExample[];
}

/**
 * Builds an immutable PromptTemplate value object. All four sections are
 * required — an empty section would silently corrupt the 4-section prompt
 * structure (ai-prompt-management R3).
 */
export function createPromptTemplate(input: PromptTemplateInput): PromptTemplate {
  const sections = [
    ['systemInstruction', input.systemInstruction],
    ['contextPlaceholder', input.contextPlaceholder],
    ['userQueryWrapper', input.userQueryWrapper],
    ['capabilityInstructions', input.capabilityInstructions],
  ] as const;

  for (const [name, value] of sections) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`PromptTemplate ${name} must be a non-empty string`);
    }
  }

  const template: PromptTemplate = {
    systemInstruction: input.systemInstruction,
    contextPlaceholder: input.contextPlaceholder,
    userQueryWrapper: input.userQueryWrapper,
    capabilityInstructions: input.capabilityInstructions,
  };

  if (input.examples !== undefined && input.examples.length > 0) {
    template.examples = Object.freeze([...input.examples]);
  }

  return Object.freeze(template);
}
