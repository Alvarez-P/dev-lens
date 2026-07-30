import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM entity for the 'workspaces' table.
 * Maps to the domain Workspace aggregate root.
 */
@Entity('workspaces')
export class WorkspaceTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ nullable: true, type: 'varchar' })
  description!: string | null;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
