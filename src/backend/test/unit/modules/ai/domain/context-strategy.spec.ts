import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';

/**
 * Task 1.2 (PR2) — ContextStrategy value object per RFC-010 §5.2 and the
 * ai-capability-framework spec R1. Consumed by the ContextAssembler (PR9)
 * and the ai-context-assembly spec (`maxContextTokens` default 4000, R4).
 */
describe('ContextStrategy (RFC-010 §5.2)', () => {
  const baseStrategy = {
    targetNodeType: NodeType.MODULE,
    relationshipDepth: 1,
    includeDependents: true,
    includeDependencies: true,
    includeApiSurface: true,
    includeEventSurface: false,
    includeDomainContext: false,
  };

  it('should define target node type, relationship depth and inclusion flags', () => {
    const strategy = createContextStrategy(baseStrategy);

    expect(strategy.targetNodeType).toBe(NodeType.MODULE);
    expect(strategy.relationshipDepth).toBe(1);
    expect(strategy.includeDependents).toBe(true);
    expect(strategy.includeDependencies).toBe(true);
    expect(strategy.includeApiSurface).toBe(true);
    expect(strategy.includeEventSurface).toBe(false);
    expect(strategy.includeDomainContext).toBe(false);
  });

  it('should default maxContextTokens to 4000 (ai-context-assembly R4)', () => {
    const strategy = createContextStrategy({
      ...baseStrategy,
      targetNodeType: NodeType.SERVICE,
      relationshipDepth: 2,
    });

    expect(strategy.maxContextTokens).toBe(4000);
  });

  it('should accept an explicit token budget and a zero depth', () => {
    const strategy = createContextStrategy({
      ...baseStrategy,
      relationshipDepth: 0,
      maxContextTokens: 8000,
    });

    expect(strategy.relationshipDepth).toBe(0);
    expect(strategy.maxContextTokens).toBe(8000);
  });

  it('should reject a negative relationship depth', () => {
    expect(() => createContextStrategy({ ...baseStrategy, relationshipDepth: -1 })).toThrow(
      /relationshipDepth/,
    );
  });

  it('should reject a non-positive token budget', () => {
    expect(() => createContextStrategy({ ...baseStrategy, maxContextTokens: 0 })).toThrow(
      /maxContextTokens/,
    );
  });

  it('should be immutable once created', () => {
    const strategy = createContextStrategy(baseStrategy);

    expect(Object.isFrozen(strategy)).toBe(true);
  });
});
