import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrganizationTypeOrmEntity } from '../typeorm/organization.typeorm-entity';
import { MemberTypeOrmEntity } from '../typeorm/member.typeorm-entity';
import { Organization } from '../../../domain/organization.entity';
import { OrganizationId } from '../../../domain/organization-id.vo';
import { UserId } from '../../../domain/user-id.vo';
import { Member, MemberId } from '../../../domain/member.entity';
import { Role } from '../../../domain/role.enum';

@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(OrganizationTypeOrmEntity)
    private readonly ormRepo: Repository<OrganizationTypeOrmEntity>,
    @InjectRepository(MemberTypeOrmEntity)
    private readonly memberRepo: Repository<MemberTypeOrmEntity>,
  ) {}

  /**
   * Find an organization by its ID.
   */
  async findById(id: OrganizationId): Promise<Organization | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });
    if (!entity) return null;

    const members = await this.memberRepo.find({
      where: { entityType: 'organization', entityId: id.toString() },
    });

    return this.toDomain(entity, members);
  }

  /**
   * Find an organization by slug.
   */
  async findBySlug(slug: string): Promise<Organization | null> {
    const entity = await this.ormRepo.findOne({ where: { slug } });
    if (!entity) return null;

    const members = await this.memberRepo.find({
      where: { entityType: 'organization', entityId: entity.id },
    });

    return this.toDomain(entity, members);
  }

  /**
   * Find all organizations a user belongs to.
   */
  async findByUserId(userId: UserId): Promise<Organization[]> {
    const memberRows = await this.memberRepo.find({
      where: { entityType: 'organization', userId: userId.toString() },
    });

    if (memberRows.length === 0) return [];

    const orgIds = memberRows.map((m) => m.entityId);
    const entities = await this.ormRepo.find({ where: { id: In(orgIds) } });

    const organizations: Organization[] = [];
    for (const entity of entities) {
      const members = await this.memberRepo.find({
        where: { entityType: 'organization', entityId: entity.id },
      });
      organizations.push(this.toDomain(entity, members));
    }

    return organizations;
  }

  /**
   * Save (create or update) an organization and its members.
   */
  async save(org: Organization): Promise<void> {
    // Save the organization itself
    const entity = this.toPersistence(org);
    await this.ormRepo.save(entity);

    // Sync members: delete old, insert current
    await this.memberRepo.delete({
      entityType: 'organization',
      entityId: org.id.toString(),
    });

    const memberEntities = org.members.map((member) => {
      const m = new MemberTypeOrmEntity();
      m.id = member.id.toString();
      m.userId = member.userId.toString();
      m.entityType = 'organization';
      m.entityId = org.id.toString();
      m.role = member.role;
      m.joinedAt = member.joinedAt;
      return m;
    });

    if (memberEntities.length > 0) {
      await this.memberRepo.save(memberEntities);
    }
  }

  /**
   * Delete an organization (cascades to members).
   */
  async delete(id: OrganizationId): Promise<void> {
    await this.memberRepo.delete({ entityType: 'organization', entityId: id.toString() });
    await this.ormRepo.delete(id.toString());
  }

  /**
   * Check if an organization exists by ID.
   */
  async exists(id: OrganizationId): Promise<boolean> {
    const count = await this.ormRepo.count({ where: { id: id.toString() } });
    return count > 0;
  }

  private toDomain(
    entity: OrganizationTypeOrmEntity,
    memberEntities: MemberTypeOrmEntity[],
  ): Organization {
    const members = memberEntities.map(
      (m) => new Member(MemberId.from(m.id), UserId.from(m.userId), m.role as Role, m.joinedAt),
    );

    return Organization.reconstitute(
      OrganizationId.from(entity.id),
      entity.name,
      entity.slug,
      entity.description,
      UserId.from(entity.ownerId),
      entity.createdAt,
      entity.updatedAt,
      members,
    );
  }

  private toPersistence(org: Organization): OrganizationTypeOrmEntity {
    const entity = new OrganizationTypeOrmEntity();
    entity.id = org.id.toString();
    entity.name = org.name;
    entity.slug = org.slug;
    entity.description = org.description;
    entity.ownerId = org.ownerId.toString();
    entity.createdAt = org.createdAt;
    entity.updatedAt = org.updatedAt;
    return entity;
  }
}
