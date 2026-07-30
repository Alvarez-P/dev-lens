import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorkspaceTypeOrmEntity } from '../typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from '../typeorm/member.typeorm-entity';
import { Workspace } from '../../../domain/workspace.entity';
import { WorkspaceId } from '../../../domain/workspace-id.vo';
import { OrganizationId } from '../../../domain/organization-id.vo';
import { UserId } from '../../../domain/user-id.vo';
import { Member, MemberId } from '../../../domain/member.entity';
import { Role } from '../../../domain/role.enum';
import { WorkspaceResponseDto } from '../../../application/dto/workspace.dto';

@Injectable()
export class WorkspaceRepository {
  constructor(
    @InjectRepository(WorkspaceTypeOrmEntity)
    private readonly ormRepo: Repository<WorkspaceTypeOrmEntity>,
    @InjectRepository(MemberTypeOrmEntity)
    private readonly memberRepo: Repository<MemberTypeOrmEntity>,
  ) {}

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });
    if (!entity) return null;

    const members = await this.memberRepo.find({
      where: { entityType: 'workspace', entityId: id.toString() },
    });

    return this.toDomain(entity, members);
  }

  async findByOrgId(orgId: OrganizationId): Promise<Workspace[]> {
    const entities = await this.ormRepo.find({
      where: { organizationId: orgId.toString() },
    });

    const workspaces: Workspace[] = [];
    for (const entity of entities) {
      const members = await this.memberRepo.find({
        where: { entityType: 'workspace', entityId: entity.id },
      });
      workspaces.push(this.toDomain(entity, members));
    }

    return workspaces;
  }

  async findByUserId(userId: UserId): Promise<WorkspaceResponseDto[]> {
    const memberRows = await this.memberRepo.find({
      where: { entityType: 'workspace', userId: userId.toString() },
    });

    if (memberRows.length === 0) return [];

    const wsIds = memberRows.map((m) => m.entityId);
    const entities = await this.ormRepo.find({ where: { id: In(wsIds) } });

    return entities.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      description: e.description,
      organizationId: e.organizationId,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  }

  async save(workspace: Workspace): Promise<void> {
    const entity = this.toPersistence(workspace);
    await this.ormRepo.save(entity);

    await this.memberRepo.delete({
      entityType: 'workspace',
      entityId: workspace.id.toString(),
    });

    const memberEntities = workspace.members.map((member) => {
      const m = new MemberTypeOrmEntity();
      m.id = member.id.toString();
      m.userId = member.userId.toString();
      m.entityType = 'workspace';
      m.entityId = workspace.id.toString();
      m.role = member.role;
      m.joinedAt = member.joinedAt;
      return m;
    });

    if (memberEntities.length > 0) {
      await this.memberRepo.save(memberEntities);
    }
  }

  async delete(id: WorkspaceId): Promise<void> {
    await this.memberRepo.delete({ entityType: 'workspace', entityId: id.toString() });
    await this.ormRepo.delete(id.toString());
  }

  async exists(id: WorkspaceId): Promise<boolean> {
    const count = await this.ormRepo.count({ where: { id: id.toString() } });
    return count > 0;
  }

  private toDomain(
    entity: WorkspaceTypeOrmEntity,
    memberEntities: MemberTypeOrmEntity[],
  ): Workspace {
    const members = memberEntities.map(
      (m) => new Member(MemberId.from(m.id), UserId.from(m.userId), m.role as Role, m.joinedAt),
    );

    return Workspace.reconstitute(
      WorkspaceId.from(entity.id),
      entity.name,
      entity.slug,
      entity.description,
      OrganizationId.from(entity.organizationId),
      entity.createdAt,
      entity.updatedAt,
      members,
    );
  }

  private toPersistence(workspace: Workspace): WorkspaceTypeOrmEntity {
    const entity = new WorkspaceTypeOrmEntity();
    entity.id = workspace.id.toString();
    entity.name = workspace.name;
    entity.slug = workspace.slug;
    entity.description = workspace.description;
    entity.organizationId = workspace.organizationId.toString();
    entity.createdAt = workspace.createdAt;
    entity.updatedAt = workspace.updatedAt;
    return entity;
  }
}
