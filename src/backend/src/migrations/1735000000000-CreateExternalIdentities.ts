import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class CreateExternalIdentities1735000000000 implements MigrationInterface {
  name = 'CreateExternalIdentities1735000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'external_identities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'external_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'access_token',
            type: 'text',
          },
          {
            name: 'refresh_token',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'token_expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'display_name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'avatar_url',
            type: 'varchar',
            isNullable: true,
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
            name: 'UQ_external_identities_provider_external_id',
            columnNames: ['provider', 'external_id'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'external_identities',
      new TableIndex({
        name: 'IDX_external_identities_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('external_identities');
  }
}
