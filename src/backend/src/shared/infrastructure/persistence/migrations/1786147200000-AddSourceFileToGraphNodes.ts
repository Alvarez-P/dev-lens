import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the nullable `source_file` column to `graph_nodes` (KG Gap G1).
 * Additive migration: existing rows keep NULL, older application versions
 * continue to function because TypeORM ignores unmapped columns by default.
 */
export class AddSourceFileToGraphNodes1786147200000 implements MigrationInterface {
  name = 'AddSourceFileToGraphNodes1786147200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE graph_nodes ADD COLUMN source_file TEXT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE graph_nodes DROP COLUMN source_file');
  }
}
