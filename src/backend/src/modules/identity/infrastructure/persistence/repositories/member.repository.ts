import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberTypeOrmEntity } from '../typeorm/member.typeorm-entity';

@Injectable()
export class MemberRepository {
  constructor(
    @InjectRepository(MemberTypeOrmEntity)
    private readonly ormRepo: Repository<MemberTypeOrmEntity>,
  ) {}

  async isUserInAnyOrganization(userId: string): Promise<boolean> {
    const count = await this.ormRepo.count({
      where: { userId, entityType: 'organization' },
    });
    return count > 0;
  }

  async findByUserId(userId: string): Promise<MemberTypeOrmEntity[]> {
    return this.ormRepo.find({ where: { userId } });
  }

  async findByEntity(entityType: string, entityId: string): Promise<MemberTypeOrmEntity[]> {
    return this.ormRepo.find({ where: { entityType, entityId } });
  }
}
