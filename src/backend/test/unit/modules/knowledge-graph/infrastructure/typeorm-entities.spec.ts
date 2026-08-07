import { getMetadataArgsStorage } from 'typeorm';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';

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

function uniqueColumnSetsOf(target: unknown): string[][] {
  return getMetadataArgsStorage()
    .uniques.filter((unique) => unique.target === target)
    .map((unique) => unique.columns as string[])
    .map((columns) => [...columns].sort());
}

describe('Knowledge graph TypeORM entities', () => {
  describe('GraphNodeEntity', () => {
    it('should map to the graph_nodes table', () => {
      expect(tableOf(GraphNodeEntity)).toBe('graph_nodes');
    });

    it('should declare all spec columns', () => {
      expect(propertyNamesOf(GraphNodeEntity)).toEqual([
        'createdAt',
        'deprecatedAt',
        'fqn',
        'id',
        'label',
        'properties',
        'repoId',
        'sourceAnalysisId',
        'sourceFile',
        'type',
        'updatedAt',
        'version',
      ]);
    });

    it('should use a uuid primary key', () => {
      expect(columnOf(GraphNodeEntity, 'id')?.options).toMatchObject({
        type: 'uuid',
        primary: true,
      });
    });

    it('should declare varchar, jsonb, and timestamptz column types', () => {
      expect(columnOf(GraphNodeEntity, 'type')?.options).toMatchObject({
        type: 'varchar',
        length: 64,
      });
      expect(columnOf(GraphNodeEntity, 'label')?.options).toMatchObject({
        type: 'varchar',
        length: 255,
      });
      expect(columnOf(GraphNodeEntity, 'fqn')?.options).toMatchObject({
        type: 'varchar',
        length: 512,
      });
      expect(columnOf(GraphNodeEntity, 'properties')?.options.type).toBe('jsonb');
      expect(columnOf(GraphNodeEntity, 'deprecatedAt')?.options).toMatchObject({
        type: 'timestamptz',
        nullable: true,
      });
    });

    it('should use snake_case physical column names', () => {
      expect(columnOf(GraphNodeEntity, 'repoId')?.options.name).toBe('repo_id');
      expect(columnOf(GraphNodeEntity, 'deprecatedAt')?.options.name).toBe('deprecated_at');
      expect(columnOf(GraphNodeEntity, 'sourceFile')?.options.name).toBe('source_file');
      expect(columnOf(GraphNodeEntity, 'sourceAnalysisId')?.options.name).toBe(
        'source_analysis_id',
      );
      expect(columnOf(GraphNodeEntity, 'createdAt')?.options.name).toBe('created_at');
      expect(columnOf(GraphNodeEntity, 'updatedAt')?.options.name).toBe('updated_at');
    });

    it('should map source_file as a nullable text column', () => {
      expect(columnOf(GraphNodeEntity, 'sourceFile')?.options).toMatchObject({
        type: 'text',
        nullable: true,
      });
    });

    it('should add created_at and updated_at timestamps', () => {
      expect(columnOf(GraphNodeEntity, 'createdAt')?.mode).toBe('createDate');
      expect(columnOf(GraphNodeEntity, 'updatedAt')?.mode).toBe('updateDate');
    });

    it('should enforce a composite unique constraint on (fqn, repo_id, version)', () => {
      expect(uniqueColumnSetsOf(GraphNodeEntity)).toEqual([['fqn', 'repoId', 'version']]);
    });

    it('should index type and repo_id columns', () => {
      expect(indexColumnSetsOf(GraphNodeEntity)).toEqual([['repoId'], ['type']]);
    });
  });

  describe('GraphEdgeEntity', () => {
    it('should map to the graph_edges table', () => {
      expect(tableOf(GraphEdgeEntity)).toBe('graph_edges');
    });

    it('should declare all spec columns', () => {
      expect(propertyNamesOf(GraphEdgeEntity)).toEqual([
        'createdAt',
        'id',
        'properties',
        'sourceNodeId',
        'targetNodeId',
        'type',
        'version',
      ]);
    });

    it('should declare non-null uuid foreign key columns', () => {
      expect(columnOf(GraphEdgeEntity, 'sourceNodeId')?.options).toMatchObject({
        name: 'source_node_id',
        type: 'uuid',
      });
      expect(columnOf(GraphEdgeEntity, 'sourceNodeId')?.options.nullable).toBeFalsy();
      expect(columnOf(GraphEdgeEntity, 'targetNodeId')?.options).toMatchObject({
        name: 'target_node_id',
        type: 'uuid',
      });
      expect(columnOf(GraphEdgeEntity, 'targetNodeId')?.options.nullable).toBeFalsy();
    });

    it('should index source and target node columns', () => {
      expect(indexColumnSetsOf(GraphEdgeEntity)).toEqual([
        ['sourceNodeId'],
        ['targetNodeId'],
        ['type'],
      ]);
    });
  });

  describe('GraphSnapshotEntity', () => {
    it('should map to the graph_snapshots table', () => {
      expect(tableOf(GraphSnapshotEntity)).toBe('graph_snapshots');
    });

    it('should declare all spec columns', () => {
      expect(propertyNamesOf(GraphSnapshotEntity)).toEqual([
        'analysisId',
        'commitSha',
        'createdAt',
        'edgeCount',
        'id',
        'nodeCount',
        'repositoryId',
        'status',
      ]);
    });

    it('should use snake_case physical column names', () => {
      expect(columnOf(GraphSnapshotEntity, 'repositoryId')?.options.name).toBe('repository_id');
      expect(columnOf(GraphSnapshotEntity, 'analysisId')?.options.name).toBe('analysis_id');
      expect(columnOf(GraphSnapshotEntity, 'commitSha')?.options.name).toBe('commit_sha');
      expect(columnOf(GraphSnapshotEntity, 'nodeCount')?.options.name).toBe('node_count');
      expect(columnOf(GraphSnapshotEntity, 'edgeCount')?.options.name).toBe('edge_count');
    });

    it('should enforce a unique constraint on analysis_id for idempotency', () => {
      expect(uniqueColumnSetsOf(GraphSnapshotEntity)).toEqual([['analysisId']]);
    });

    it('should index (repository_id, created_at) for latest-repo lookups', () => {
      expect(indexColumnSetsOf(GraphSnapshotEntity)).toEqual([['createdAt', 'repositoryId']]);
    });
  });
});
