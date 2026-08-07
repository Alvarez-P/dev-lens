import { Injectable } from '@nestjs/common';
import { IrModule, IrMethod } from '../../analysis/domain/ir-nodes';
import { CodeSketch, MethodSketch, ParamSketch } from '../domain/code-sketch.vo';

/** ~4 chars per token heuristic (see design.md). */
export const SKETCH_MAX_TOKENS = 4000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Serializes a CodeSketch into its signature-only text form (REQ-CA-002).
 *
 * This is the exact text the LLM sees inside `<code>` blocks. It contains
 * only signatures — method bodies, comments, and non-route string literals
 * never reach the IR so they can never appear here.
 */
export function serializeSketch(sketch: CodeSketch): string {
  const lines: string[] = [];

  for (const decorator of sketch.decorators) {
    lines.push(decorator);
  }

  const heritage: string[] = [];

  if (sketch.extends) {
    heritage.push(`extends ${sketch.extends}`);
  }

  if (sketch.implements.length > 0) {
    heritage.push(`implements ${sketch.implements.join(', ')}`);
  }

  lines.push(`class ${sketch.className}${heritage.length > 0 ? ' ' + heritage.join(' ') : ''} {`);

  if (sketch.constructorParams.length > 0) {
    const params = sketch.constructorParams.map(serializeParam).join(', ');
    lines.push(`  constructor(${params});`);
  }

  for (const method of sketch.methods) {
    for (const decorator of method.decorators) {
      lines.push(`  ${decorator}`);
    }

    const params = method.params.map(serializeParam).join(', ');
    lines.push(`  ${method.name}(${params}): ${method.returnType};`);
  }

  lines.push('}');

  return lines.join('\n');
}

function serializeParam(param: ParamSketch): string {
  const decorators = param.decorators.join(' ');

  return `${decorators}${decorators ? ' ' : ''}${param.name}: ${param.type}`.trim();
}

/**
 * Builds signature-level CodeSketch objects from the IR (REQ-CA-002/003).
 *
 * One sketch per analysis unit (file). Private helper methods without
 * decorators are excluded. Sketches over 4000 tokens are truncated while
 * keeping the class-level signature and full method signatures in declaration
 * order — never a partial method.
 */
@Injectable()
export class CodeSketchBuilder {
  /**
   * Build a CodeSketch from a single IR module (file).
   * Returns null when the module has no class to sketch.
   */
  build(module: IrModule, rootPath: string): CodeSketch | null {
    const cls = module.classes[0];

    if (cls === undefined) {
      return null;
    }

    const sourceFile = this.toRepoRelative(module.path, rootPath);
    const base: Omit<CodeSketch, 'methods' | 'truncated' | 'omittedMethodCount'> = {
      sourceFile,
      className: cls.name,
      decorators: [...cls.decorators],
      extends: cls.extends ?? undefined,
      implements: [...cls.implements],
      constructorParams: cls.constructorParams.map(toParamSketch),
      imports: [...module.imports],
    };

    const methods = cls.methods.filter(this.isIncluded).map(toMethodSketch);

    return this.applyTruncation(base, methods);
  }

  /** Serialize a sketch to its LLM-facing text form. */
  serialize(sketch: CodeSketch): string {
    return serializeSketch(sketch);
  }

  private isIncluded(method: IrMethod): boolean {
    if (method.visibility === 'private' && method.decorators.length === 0) {
      return false;
    }

    return true;
  }

  private applyTruncation(
    base: Omit<CodeSketch, 'methods' | 'truncated' | 'omittedMethodCount'>,
    methods: MethodSketch[],
  ): CodeSketch {
    const full: CodeSketch = { ...base, methods, truncated: false };

    if (estimateTokens(serializeSketch(full)) <= SKETCH_MAX_TOKENS) {
      return full;
    }

    // Include methods in declaration order until the budget is exhausted —
    // never truncate mid-method.
    const kept: MethodSketch[] = [];

    for (const method of methods) {
      const candidate: CodeSketch = {
        ...base,
        methods: [...kept, method],
        truncated: true,
        omittedMethodCount: methods.length - kept.length - 1,
      };

      if (estimateTokens(serializeSketch(candidate)) > SKETCH_MAX_TOKENS) {
        break;
      }

      kept.push(method);
    }

    return {
      ...base,
      methods: kept,
      truncated: true,
      omittedMethodCount: methods.length - kept.length,
    };
  }

  private toRepoRelative(filePath: string, rootPath: string): string {
    const normalizedRoot = rootPath.replace(/\/+$/, '');

    if (filePath.startsWith(normalizedRoot)) {
      return filePath.slice(normalizedRoot.length).replace(/^\/+/, '');
    }

    return filePath;
  }
}

function toParamSketch(param: {
  name: string;
  type: string;
  decorators: readonly string[];
}): ParamSketch {
  return { name: param.name, type: param.type, decorators: [...param.decorators] };
}

function toMethodSketch(method: IrMethod): MethodSketch {
  return {
    name: method.name,
    decorators: [...method.decorators],
    params: method.params.map(toParamSketch),
    returnType: method.returnType,
  };
}
