import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberTypeOrmEntity } from '../typeorm/member.typeorm-entity';

/**
 * Repository for direct member queries.
 * Used for cross-cutting member lookups without loading the full aggregate.
 */
@Injectable()
export class MemberRepository {
  constructor(
    @InjectRepository(MemberTypeOrmEntity)
    private readonly ormRepo: Repository<MemberTypeOrmEntity>,
  ) {}

  /**
   * Check if a user is a member of any organization.
   */
  async isUserInAnyOrganization(userId: string): Promise<boolean> {
    const count = await this.ormRepo.count({
      where: { userId, entityType: 'organization' },
    });
    return count > 0;
  }

  /**
   * Find all memberships for a user (both org and workspace).
   */
  async findByUserId(userId: string): Promise<MemberTypeOrmEntity[]> {
    return this.ormRepo.find({ where: { userId } });
  }

  /**
   * Find members of a specific entity (org or workspace).
   */
  async findByEntity(entityType: string, entityId: string): Promise<MemberTypeOrmEntity[]> {
    return this.ormRepo.find({ where: { entityType, entityId } });
  }
}
