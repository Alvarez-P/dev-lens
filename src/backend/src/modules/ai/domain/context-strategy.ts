import { NodeType } from '../../knowledge-graph/domain/node-type.enum';

/**
 * Defines what Knowledge Graph context is assembled before prompt generation
 * (RFC-010 §5.2). Consumed by the ContextAssembler: relationship depth drives
 * `GraphQueryService.getNodeWithEdges(target, direction, depth)` and
 * `maxContextTokens` is the context token budget (default 4000, per the
 * ai-context-assembly spec R4).
 */
export interface ContextStrategy {
  /** What the capability explains. */
  targetNodeType: NodeType;
  /** How many hops to traverse. */
  relationshipDepth: number;
  /** Nodes that depend on the target. */
  includeDependents: boolean;
  /** Nodes the target depends on. */
  includeDependencies: boolean;
  /** Endpoints exposed by the target. */
  includeApiSurface: boolean;
  /** Events published/consumed by the target. */
  includeEventSurface: boolean;
  /** Bounded context and aggregate the target belongs to. */
  includeDomainContext: boolean;
  /** Token budget for context. */
  maxContextTokens: number;
}

export interface ContextStrategyInput {
  targetNodeType: NodeType;
  relationshipDepth: number;
  includeDependents: boolean;
  includeDependencies: boolean;
  includeApiSurface: boolean;
  includeEventSurface: boolean;
  includeDomainContext: boolean;
  /** Defaults to 4000 (ai-context-assembly R4). */
  maxContextTokens?: number;
}

/** Default context token budget (ai-context-assembly R4). */
export const DEFAULT_CONTEXT_MAX_TOKENS = 4000;

/**
 * Builds an immutable ContextStrategy value object, enforcing the numeric
 * invariants the assembler depends on: depth is a non-negative hop count and
 * the token budget is positive.
 */
export function createContextStrategy(input: ContextStrategyInput): ContextStrategy {
  if (!Number.isInteger(input.relationshipDepth) || input.relationshipDepth < 0) {
    throw new Error(
      `ContextStrategy relationshipDepth must be a non-negative integer, got ${input.relationshipDepth}`,
    );
  }

  const maxContextTokens = input.maxContextTokens ?? DEFAULT_CONTEXT_MAX_TOKENS;

  if (!Number.isInteger(maxContextTokens) || maxContextTokens <= 0) {
    throw new Error(
      `ContextStrategy maxContextTokens must be a positive integer, got ${maxContextTokens}`,
    );
  }

  return Object.freeze({
    targetNodeType: input.targetNodeType,
    relationshipDepth: input.relationshipDepth,
    includeDependents: input.includeDependents,
    includeDependencies: input.includeDependencies,
    includeApiSurface: input.includeApiSurface,
    includeEventSurface: input.includeEventSurface,
    includeDomainContext: input.includeDomainContext,
    maxContextTokens,
  });
}
