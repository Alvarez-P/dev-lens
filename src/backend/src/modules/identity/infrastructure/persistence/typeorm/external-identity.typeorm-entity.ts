import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('external_identities')
@Unique('UQ_external_identities_provider_external_id', ['provider', 'externalId'])
@Index('IDX_external_identities_user_id', ['userId'])
export class ExternalIdentityTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ length: 20 })
  provider!: string;

  @Column({ name: 'external_id', length: 255 })
  externalId!: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken!: string;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken!: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ name: 'display_name', nullable: true, type: 'varchar' })
  displayName!: string | null;

  @Column({ name: 'avatar_url', nullable: true, type: 'varchar' })
  avatarUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
