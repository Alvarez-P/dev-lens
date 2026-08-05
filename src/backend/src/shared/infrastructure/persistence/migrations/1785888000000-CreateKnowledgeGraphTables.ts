import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateKnowledgeGraphTables1785888000000 implements MigrationInterface {
  name = 'CreateKnowledgeGraphTables1785888000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'graph_nodes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'label',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'fqn',
            type: 'varchar',
            length: '512',
          },
          {
            name: 'properties',
            type: 'jsonb',
          },
          {
            name: 'repo_id',
            type: 'uuid',
          },
          {
            name: 'version',
            type: 'integer',
          },
          {
            name: 'deprecated_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'source_analysis_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_graph_nodes_fqn_repo_version',
            columnNames: ['fqn', 'repo_id', 'version'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'graph_nodes',
      new TableIndex({ name: 'IDX_graph_nodes_type', columnNames: ['type'] }),
    );

    await queryRunner.createIndex(
      'graph_nodes',
      new TableIndex({ name: 'IDX_graph_nodes_repo_id', columnNames: ['repo_id'] }),
    );

    await queryRunner.query(
      'CREATE INDEX IDX_graph_nodes_properties_gin ON graph_nodes USING GIN (properties)',
    );

    await queryRunner.createTable(
      new Table({
        name: 'graph_edges',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'source_node_id',
            type: 'uuid',
          },
          {
            name: 'target_node_id',
            type: 'uuid',
          },
          {
            name: 'properties',
            type: 'jsonb',
          },
          {
            name: 'version',
            type: 'integer',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'graph_edges',
      new TableIndex({ name: 'IDX_graph_edges_type', columnNames: ['type'] }),
    );

    await queryRunner.createIndex(
      'graph_edges',
      new TableIndex({ name: 'IDX_graph_edges_source_node_id', columnNames: ['source_node_id'] }),
    );

    await queryRunner.createIndex(
      'graph_edges',
      new TableIndex({ name: 'IDX_graph_edges_target_node_id', columnNames: ['target_node_id'] }),
    );

    await queryRunner.createForeignKeys('graph_edges', [
      new TableForeignKey({
        name: 'FK_graph_edges_source_node',
        columnNames: ['source_node_id'],
        referencedTableName: 'graph_nodes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_graph_edges_target_node',
        columnNames: ['target_node_id'],
        referencedTableName: 'graph_nodes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'graph_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'repository_id',
            type: 'uuid',
          },
          {
            name: 'analysis_id',
            type: 'uuid',
          },
          {
            name: 'commit_sha',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'node_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'edge_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_graph_snapshots_analysis_id',
            columnNames: ['analysis_id'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'graph_snapshots',
      new TableIndex({
        name: 'IDX_graph_snapshots_repo_created_at',
        columnNames: ['repository_id', 'created_at'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('graph_snapshots');
    await queryRunner.dropTable('graph_edges');
    await queryRunner.dropTable('graph_nodes');
  }
}
