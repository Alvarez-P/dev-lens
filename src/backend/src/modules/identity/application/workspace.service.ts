import { Injectable, Inject } from '@nestjs/common';
import { WorkspaceRepository } from '../infrastructure/persistence/repositories/workspace.repository';
import { OrganizationRepository } from '../infrastructure/persistence/repositories/organization.repository';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { Workspace } from '../domain/workspace.entity';
import { WorkspaceId } from '../domain/workspace-id.vo';
import { OrganizationId } from '../domain/organization-id.vo';
import { UserId } from '../domain/user-id.vo';
import { Role } from '../domain/role.enum';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';

import {
  WorkspaceNotFoundError,
  OrganizationNotFoundError,
  UserNotFoundError,
  NotOrganizationMemberError,
  InsufficientPermissionsError,
} from '../domain/identity-errors';

import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceResponseDto } from './dto/workspace.dto';
import { MemberResponseDto } from './dto/organization.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
  ) {}

  /**
   * Create a new workspace within an organization.
   */
  async create(dto: CreateWorkspaceDto, userId: string): Promise<WorkspaceResponseDto> {
    const org = await this.organizationRepository.findById(OrganizationId.from(dto.organizationId));
    if (!org) throw new OrganizationNotFoundError(dto.organizationId);

    // Ensure user is a member of the org
    if (!org.hasMember(UserId.from(userId))) {
      throw new NotOrganizationMemberError();
    }

    const slug = this.generateSlug(dto.name);
    const workspace = Workspace.create(
      dto.name,
      slug,
      dto.description ?? null,
      org.id,
      UserId.from(userId),
    );

    await this.workspaceRepository.save(workspace);
    await this.eventDispatcher.dispatchBatch(workspace.domainEvents);

    return this.toResponse(workspace);
  }

  /**
   * Find a workspace by ID.
   */
  async findById(id: string, userId: string): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findById(WorkspaceId.from(id));
    if (!workspace) throw new WorkspaceNotFoundError(id);

    this.ensureMember(workspace, UserId.from(userId));
    return this.toResponse(workspace);
  }

  /**
   * Find all workspaces for an organization.
   */
  async findByOrg(orgId: string, userId: string): Promise<WorkspaceResponseDto[]> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    if (!org.hasMember(UserId.from(userId))) {
      throw new NotOrganizationMemberError();
    }

    const workspaces = await this.workspaceRepository.findByOrgId(OrganizationId.from(orgId));
    return workspaces.map((w) => this.toResponse(w));
  }

  /**
   * Get all workspaces the user can access.
   */
  async findAll(userId: string): Promise<WorkspaceResponseDto[]> {
    return this.workspaceRepository.findByUserId(UserId.from(userId));
  }

  /**
   * Update workspace details.
   */
  async update(id: string, userId: string, dto: UpdateWorkspaceDto): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findById(WorkspaceId.from(id));
    if (!workspace) throw new WorkspaceNotFoundError(id);

    this.ensureAdmin(workspace, UserId.from(userId));

    workspace.updateDetails({ name: dto.name, description: dto.description });
    await this.workspaceRepository.save(workspace);

    return this.toResponse(workspace);
  }

  /**
   * Delete a workspace.
   */
  async delete(id: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(WorkspaceId.from(id));
    if (!workspace) throw new WorkspaceNotFoundError(id);

    this.ensureAdmin(workspace, UserId.from(userId));
    await this.workspaceRepository.delete(workspace.id);
  }

  /**
   * Add a member to the workspace.
   */
  async addMember(
    workspaceId: string,
    memberUserId: string,
    userId: string,
  ): Promise<MemberResponseDto> {
    const workspace = await this.workspaceRepository.findById(WorkspaceId.from(workspaceId));
    if (!workspace) throw new WorkspaceNotFoundError(workspaceId);

    this.ensureAdmin(workspace, UserId.from(userId));

    const userToAdd = await this.userRepository.findById(UserId.from(memberUserId));
    if (!userToAdd) throw new UserNotFoundError(memberUserId);

    const member = workspace.addMember(userToAdd.id, Role.MEMBER);
    await this.workspaceRepository.save(workspace);

    return {
      id: member.id.toString(),
      userId: member.userId.toString(),
      email: userToAdd.email.toString(),
      firstName: userToAdd.firstName,
      lastName: userToAdd.lastName,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  /**
   * Remove a member from the workspace.
   */
  async removeMember(workspaceId: string, memberId: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(WorkspaceId.from(workspaceId));
    if (!workspace) throw new WorkspaceNotFoundError(workspaceId);

    this.ensureAdmin(workspace, UserId.from(userId));

    const member = workspace.members.find((m) => m.id.toString() === memberId);
    if (!member) {
      throw new Error('Member not found');
    }

    workspace.removeMember(member.id);
    await this.workspaceRepository.save(workspace);
  }

  /**
   * Get members of a workspace.
   */
  async getMembers(workspaceId: string, userId: string): Promise<MemberResponseDto[]> {
    const workspace = await this.workspaceRepository.findById(WorkspaceId.from(workspaceId));
    if (!workspace) throw new WorkspaceNotFoundError(workspaceId);

    this.ensureMember(workspace, UserId.from(userId));

    const memberResponses: MemberResponseDto[] = [];
    for (const member of workspace.members) {
      const user = await this.userRepository.findById(member.userId);
      memberResponses.push({
        id: member.id.toString(),
        userId: member.userId.toString(),
        email: user?.email.toString() ?? '',
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      });
    }

    return memberResponses;
  }

  private ensureMember(workspace: Workspace, userId: UserId): void {
    if (!workspace.hasMember(userId)) {
      throw new InsufficientPermissionsError('workspace member');
    }
  }

  private ensureAdmin(workspace: Workspace, userId: UserId): void {
    const member = workspace.getMemberByUserId(userId);
    if (!member || !member.hasRole(Role.ADMIN)) {
      throw new InsufficientPermissionsError('workspace admin');
    }
  }

  private toResponse(workspace: Workspace): WorkspaceResponseDto {
    return {
      id: workspace.id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      organizationId: workspace.organizationId.toString(),
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100) || 'workspace'
    );
  }
}
