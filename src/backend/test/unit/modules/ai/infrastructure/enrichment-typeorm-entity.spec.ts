import { getMetadataArgsStorage } from 'typeorm';
import { IrEnrichmentEntity } from '@/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity';

type ColumnArg = {
  mode?: string;
  propertyName: string;
  options: {
    name?: string;
    type?: unknown;
    nullable?: boolean;
    primary?: boolean;
    generated?: string;
    createDate?: boolean;
    updateDate?: boolean;
  };
};

function tableOf(target: unknown): string | undefined {
  return getMetadataArgsStorage().tables.find((table) => table.target === target)?.name;
}

function columnsOf(target: unknown): ColumnArg[] {
  return getMetadataArgsStorage().columns.filter(
    (column) => column.target === target,
  ) as ColumnArg[];
}

function columnOf(target: unknown, propertyName: string): ColumnArg | undefined {
  return columnsOf(target).find((column) => column.propertyName === propertyName);
}

function propertyNamesOf(target: unknown): string[] {
  return columnsOf(target)
    .map((column) => column.propertyName)
    .sort();
}

function uniqueColumnSetsOf(target: unknown): string[][] {
  return getMetadataArgsStorage()
    .uniques.filter((unique) => unique.target === target)
    .map((unique) => unique.columns as string[])
    .map((columns) => [...columns].sort());
}

/**
 * Task 5.1 (REQ-EP-006): IrEnrichment persists as jsonb with a unique
 * constraint on analysisId — the idempotency key. The entity mirrors the
 * immutable aggregate: no update columns, only creation timestamp.
 */
describe('IrEnrichmentEntity', () => {
  it('should map to the ir_enrichments table', () => {
    expect(tableOf(IrEnrichmentEntity)).toBe('ir_enrichments');
  });

  it('should declare all artifact columns', () => {
    expect(propertyNamesOf(IrEnrichmentEntity)).toEqual([
      'analysisId',
      'architecture',
      'classes',
      'completedAt',
      'confidence',
      'createdAt',
      'failedUnits',
      'framework',
      'id',
      'manifestSha256',
      'repositoryId',
    ]);
  });

  it('should use a uuid primary key', () => {
    expect(columnOf(IrEnrichmentEntity, 'id')?.options).toMatchObject({
      type: 'uuid',
      primary: true,
    });
  });

  it('should store classes and failedUnits as jsonb', () => {
    expect(columnOf(IrEnrichmentEntity, 'classes')?.options.type).toBe('jsonb');
    expect(columnOf(IrEnrichmentEntity, 'failedUnits')?.options.type).toBe('jsonb');
  });

  it('should use snake_case physical column names', () => {
    expect(columnOf(IrEnrichmentEntity, 'analysisId')?.options.name).toBe('analysis_id');
    expect(columnOf(IrEnrichmentEntity, 'repositoryId')?.options.name).toBe('repository_id');
    expect(columnOf(IrEnrichmentEntity, 'manifestSha256')?.options.name).toBe('manifest_sha256');
    expect(columnOf(IrEnrichmentEntity, 'completedAt')?.options.name).toBe('completed_at');
    expect(columnOf(IrEnrichmentEntity, 'createdAt')?.options.name).toBe('created_at');
  });

  it('should enforce a unique constraint on analysis_id for idempotency', () => {
    expect(uniqueColumnSetsOf(IrEnrichmentEntity)).toEqual([['analysisId']]);
  });

  it('should record completedAt as timestamptz and createdAt as create-date', () => {
    expect(columnOf(IrEnrichmentEntity, 'completedAt')?.options.type).toBe('timestamptz');
    expect(columnOf(IrEnrichmentEntity, 'createdAt')?.mode).toBe('createDate');
  });
});
