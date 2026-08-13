import { getMetadataArgsStorage } from 'typeorm';
import { DocArtifactEntity } from '@/modules/documentation/infrastructure/persistence/typeorm/doc-artifact.typeorm-entity';

type ColumnArg = {
  mode?: string;
  propertyName: string;
  options: {
    name?: string;
    type?: unknown;
    length?: number;
    nullable?: boolean;
    primary?: boolean;
    generated?: string;
    createDate?: boolean;
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

function indexColumnSetsOf(target: unknown): string[][] {
  return getMetadataArgsStorage()
    .indices.filter((index) => index.target === target)
    .map((index) =>
      Array.isArray(index.columns)
        ? index.columns
        : index.columns === undefined
          ? []
          : [index.columns],
    )
    .filter((columns) => columns.every((column) => typeof column === 'string'))
    .map((columns) => [...(columns as string[])].sort())
    .sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

/**
 * Task 4.3 (PR3) — DocArtifactEntity TypeORM mapping (documentation-storage
 * R4/R5). Structural assertions via getMetadataArgsStorage, mirroring the
 * knowledge-graph typeorm-entities.spec.ts convention.
 */
describe('DocArtifactEntity — TypeORM mapping', () => {
  it('should map to the doc_artifacts table', () => {
    expect(tableOf(DocArtifactEntity)).toBe('doc_artifacts');
  });

  it('should declare all storage R4 fields', () => {
    expect(propertyNamesOf(DocArtifactEntity)).toEqual([
      'aiModelVersion',
      'commitSha',
      'createdAt',
      'docType',
      'format',
      'generatedAt',
      'id',
      'minioKey',
      'repositoryId',
      'sizeBytes',
      'status',
      'templateVersion',
    ]);
  });

  it('should use a uuid primary key', () => {
    expect(columnOf(DocArtifactEntity, 'id')?.options).toMatchObject({
      type: 'uuid',
      primary: true,
    });
  });

  it('should use snake_case physical column names', () => {
    expect(columnOf(DocArtifactEntity, 'repositoryId')?.options.name).toBe('repository_id');
    expect(columnOf(DocArtifactEntity, 'commitSha')?.options.name).toBe('commit_sha');
    expect(columnOf(DocArtifactEntity, 'docType')?.options.name).toBe('doc_type');
    expect(columnOf(DocArtifactEntity, 'minioKey')?.options.name).toBe('minio_key');
    expect(columnOf(DocArtifactEntity, 'sizeBytes')?.options.name).toBe('size_bytes');
    expect(columnOf(DocArtifactEntity, 'generatedAt')?.options.name).toBe('generated_at');
    expect(columnOf(DocArtifactEntity, 'templateVersion')?.options.name).toBe('template_version');
    expect(columnOf(DocArtifactEntity, 'aiModelVersion')?.options.name).toBe('ai_model_version');
  });

  it('should map commitSha as a varchar(64) column', () => {
    expect(columnOf(DocArtifactEntity, 'commitSha')?.options).toMatchObject({
      type: 'varchar',
      length: 64,
    });
  });

  it('should map sizeBytes as an integer and generatedAt as timestamptz', () => {
    expect(columnOf(DocArtifactEntity, 'sizeBytes')?.options).toMatchObject({ type: 'integer' });
    expect(columnOf(DocArtifactEntity, 'generatedAt')?.options).toMatchObject({
      type: 'timestamptz',
    });
  });

  it('should make aiModelVersion nullable and the rest non-null', () => {
    expect(columnOf(DocArtifactEntity, 'aiModelVersion')?.options.nullable).toBe(true);
    expect(columnOf(DocArtifactEntity, 'commitSha')?.options.nullable).toBeFalsy();
    expect(columnOf(DocArtifactEntity, 'minioKey')?.options.nullable).toBeFalsy();
  });

  it('should add a created_at timestamp column', () => {
    expect(columnOf(DocArtifactEntity, 'createdAt')?.mode).toBe('createDate');
  });

  it('should index (repositoryId, commitSha, docType, templateVersion) for idempotency', () => {
    expect(indexColumnSetsOf(DocArtifactEntity)).toEqual([
      ['commitSha', 'docType', 'repositoryId', 'templateVersion'],
    ]);
  });
});
