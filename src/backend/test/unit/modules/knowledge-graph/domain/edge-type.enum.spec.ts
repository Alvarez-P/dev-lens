import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

describe('EdgeType enum', () => {
  it('should define the exact edge taxonomy', () => {
    expect(Object.values(EdgeType)).toEqual([
      'BELONGS_TO',
      'IMPLEMENTS',
      'EXTENDS',
      'IMPORTS',
      'DEPENDS_ON',
      'EXPOSES',
    ]);
  });

  it('should expose each edge type as a string value', () => {
    expect(EdgeType.BELONGS_TO).toBe('BELONGS_TO');
    expect(EdgeType.IMPLEMENTS).toBe('IMPLEMENTS');
    expect(EdgeType.EXTENDS).toBe('EXTENDS');
    expect(EdgeType.IMPORTS).toBe('IMPORTS');
    expect(EdgeType.DEPENDS_ON).toBe('DEPENDS_ON');
    expect(EdgeType.EXPOSES).toBe('EXPOSES');
  });
});
