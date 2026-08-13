import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';

describe('DocFormat', () => {
  it('should expose the six registry format keys', () => {
    expect(Object.values(DocFormat)).toEqual([
      'markdown',
      'html',
      'openapi',
      'mermaid',
      'plantuml',
      'json',
    ]);
  });

  it('should keep extension strings distinct from format keys', () => {
    expect(DocFormat.OPENAPI).toBe('openapi');
    expect(DocFormat.MERMAID).toBe('mermaid');
  });
});
