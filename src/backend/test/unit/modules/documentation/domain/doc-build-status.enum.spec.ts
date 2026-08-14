import { DocBuildStatus } from '@/modules/documentation/domain/doc-build-status.enum';

describe('DocBuildStatus', () => {
  it('should expose pending/building/completed/failed/skipped lifecycle states', () => {
    expect(Object.values(DocBuildStatus)).toEqual([
      'pending',
      'building',
      'completed',
      'failed',
      'skipped',
    ]);
  });
});
