import { DocType } from '@/modules/documentation/domain/doc-type.enum';

describe('DocType', () => {
  it('should expose the five built-in documentation types', () => {
    expect(Object.values(DocType)).toEqual([
      'readme',
      'architecture-guide',
      'api-reference',
      'module-docs',
      'onboarding-guide',
    ]);
  });

  it('should use module-docs (not module-documentation) for module documentation', () => {
    expect(DocType.MODULE_DOCS).toBe('module-docs');
    expect(DocType.MODULE_DOCS).not.toBe('module-documentation');
  });
});
