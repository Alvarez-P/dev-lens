import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { createContextStrategy } from '@/modules/ai/domain/context-strategy';
import { createPromptTemplate } from '@/modules/ai/domain/prompt-template';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';
import { ValidationRule } from '@/modules/ai/domain/output/validation-rule';
import { createCapability } from '@/modules/ai/domain/ai-capability';

/**
 * Task 1.2 (PR2) — full AICapability entity per spec R1 and RFC-010 §5.1:
 * id, name, description, version, tier, contextStrategy, promptTemplate,
 * outputFormat, validationRules, enabled. `tier` SHALL default to "free".
 */
describe('AICapability (spec R1)', () => {
  const validationRules: ValidationRule[] = [{ kind: 'length', maxChars: 6000 }];

  function validCapability() {
    return {
      id: 'explain-module',
      name: 'Explain Module',
      description: 'Summarize what a module does, its dependencies, and its role',
      version: 1,
      enabled: true,
      contextStrategy: createContextStrategy({
        targetNodeType: NodeType.MODULE,
        relationshipDepth: 1,
        includeDependents: true,
        includeDependencies: true,
        includeApiSurface: true,
        includeEventSurface: false,
        includeDomainContext: false,
      }),
      promptTemplate: createPromptTemplate({
        systemInstruction: 'You are a DevLens architect.',
        contextPlaceholder: '{{context}}',
        userQueryWrapper: 'Question: {query}',
        capabilityInstructions: 'Explain the module in the context.',
      }),
      outputFormat: createOutputFormat({ type: 'markdown' }),
      validationRules,
    };
  }

  it('should build a full capability with every required field populated', () => {
    const capability = createCapability(validCapability());

    expect(capability.id).toBe('explain-module');
    expect(capability.name).toBe('Explain Module');
    expect(capability.description).toBe(
      'Summarize what a module does, its dependencies, and its role',
    );
    expect(capability.version).toBe(1);
    expect(capability.enabled).toBe(true);
    expect(capability.contextStrategy.targetNodeType).toBe(NodeType.MODULE);
    expect(capability.contextStrategy.relationshipDepth).toBe(1);
    expect(capability.promptTemplate.systemInstruction).toBe('You are a DevLens architect.');
    expect(capability.outputFormat.type).toBe('markdown');
    expect(capability.validationRules).toHaveLength(1);
    expect(capability.validationRules[0]).toEqual(validationRules[0]);
  });

  it('should default tier to free', () => {
    const capability = createCapability(validCapability());

    expect(capability.tier).toBe('free');
  });

  it('should keep an explicit tier', () => {
    const capability = createCapability({ ...validCapability(), tier: 'professional' });

    expect(capability.tier).toBe('professional');
  });

  it('should default validationRules to an empty list', () => {
    const capability = createCapability({
      ...validCapability(),
      validationRules: undefined,
    });

    expect(capability.validationRules).toEqual([]);
  });

  it('should reject a non-slug capability id', () => {
    expect(() => createCapability({ ...validCapability(), id: 'Explain Module' })).toThrow(/id/);
  });

  it('should reject an empty name', () => {
    expect(() => createCapability({ ...validCapability(), name: '' })).toThrow(/name/);
  });

  it('should reject a version below 1', () => {
    expect(() => createCapability({ ...validCapability(), version: 0 })).toThrow(/version/);
  });
});
