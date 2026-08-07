/** Constructor or method parameter signature (REQ-CA-002). */
export interface ParamSketch {
  name: string;
  type: string;
  decorators: string[];
}

/** Public decorated method signature (REQ-CA-002). */
export interface MethodSketch {
  name: string;
  decorators: string[];
  params: ParamSketch[];
  returnType: string;
}

/**
 * Signature-level context the LLM sees per source file (REQ-CA-002).
 *
 * Includes ONLY signatures — never method bodies, comments, or non-route
 * string literals. `truncated: true` signals omitted methods; the prompt
 * builder must then instruct the model not to fabricate omitted endpoints.
 */
export interface CodeSketch {
  /** Relative path from repo root (IrNode.filePath). */
  sourceFile: string;
  className: string;
  /** Decorator names WITH arguments, e.g. "@Controller('users')". */
  decorators: string[];
  /** FQN of parent class, if any. */
  extends?: string;
  /** FQNs of implemented interfaces. */
  implements: string[];
  constructorParams: ParamSketch[];
  methods: MethodSketch[];
  /** Deduplicated; external packages as bare name, relative imports as FQN. */
  imports: string[];
  /** True if the sketch exceeds the 4000-token cap. */
  truncated: boolean;
  /** Present only when truncated. */
  omittedMethodCount?: number;
}
