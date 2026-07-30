import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * TypeORM entity for the 'members' table.
 * Polymorphic: members can belong to either an organization or a workspace.
 * Uses entity_type + entity_id to identify the parent aggregate.
 */
@Entity('members')
export class MemberTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'entity_type' })
  entityType!: string; // 'organization' | 'workspace'

  @Column({ name: 'entity_id' })
  entityId!: string;

  @Column()
  role!: string;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}
