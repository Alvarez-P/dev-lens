import {
  DOCUMENTATION_QUEUE,
  DOCUMENTATION_DLQ,
  FORMAT_RENDERER,
  DOC_TEMPLATE_REGISTRY,
} from '@/modules/documentation/documentation.tokens';

describe('documentation tokens', () => {
  it('should define the BullMQ queue and DLQ names (documentation-generation)', () => {
    expect(DOCUMENTATION_QUEUE).toBe('documentation-generation');
    expect(DOCUMENTATION_DLQ).toBe('documentation-generation-dlq');
  });

  it('should define the FORMAT_RENDERER multi-provider token', () => {
    expect(FORMAT_RENDERER).toBe('FORMAT_RENDERER');
  });

  it('should define the DOC_TEMPLATE_REGISTRY token', () => {
    expect(DOC_TEMPLATE_REGISTRY).toBe('DOC_TEMPLATE_REGISTRY');
  });
});
