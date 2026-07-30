import { Injectable, Inject } from '@nestjs/common';
import { OrganizationRepository } from '../infrastructure/persistence/repositories/organization.repository';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { Organization } from '../domain/organization.entity';
import { OrganizationId } from '../domain/organization-id.vo';
import { UserId } from '../domain/user-id.vo';
import { Email } from '../domain/email.vo';
import { Role } from '../domain/role.enum';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';

import {
  OrganizationNotFoundError,
  UserNotFoundError,
  NotOrganizationOwnerError,
  NotOrganizationMemberError,
  MemberAlreadyExistsError,
  InsufficientPermissionsError,
  CannotRemoveLastOwnerError,
} from '../domain/identity-errors';

import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  OrganizationResponseDto,
  MemberResponseDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
  ) {}

  /**
   * Create a new organization.
   */
  async create(dto: CreateOrganizationDto, userId: string): Promise<OrganizationResponseDto> {
    const ownerId = UserId.from(userId);
    const slug = this.generateSlug(dto.name);

    const org = Organization.create(dto.name, slug, dto.description ?? null, ownerId);
    await this.organizationRepository.save(org);
    await this.eventDispatcher.dispatchBatch(org.domainEvents);

    return this.toResponse(org);
  }

  /**
   * Find an organization by ID.
   */
  async findById(id: string, userId: string): Promise<OrganizationResponseDto> {
    const org = await this.organizationRepository.findById(OrganizationId.from(id));
    if (!org) {
      throw new OrganizationNotFoundError(id);
    }
    this.ensureMember(org, UserId.from(userId));
    return this.toResponse(org);
  }

  /**
   * Find an organization by slug.
   */
  async findBySlug(slug: string): Promise<OrganizationResponseDto | null> {
    const org = await this.organizationRepository.findBySlug(slug);
    if (!org) return null;
    return this.toResponse(org);
  }

  /**
   * List all organizations (with pagination — simplified for now).
   */
  async findAll(userId: string): Promise<OrganizationResponseDto[]> {
    const orgs = await this.organizationRepository.findByUserId(UserId.from(userId));
    return orgs.map((org) => this.toResponse(org));
  }

  /**
   * Update organization details.
   */
  async update(
    orgId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    this.ensureOwnerOrAdmin(org, UserId.from(userId));

    org.updateDetails({ name: dto.name, description: dto.description });
    await this.organizationRepository.save(org);

    return this.toResponse(org);
  }

  /**
   * Delete an organization (owner only).
   */
  async delete(orgId: string, userId: string): Promise<void> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    this.ensureOwner(org, UserId.from(userId));
    await this.organizationRepository.delete(org.id);
  }

  /**
   * Add a member to the organization.
   */
  async addMember(orgId: string, userId: string, dto: AddMemberDto): Promise<MemberResponseDto> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    this.ensureOwnerOrAdmin(org, UserId.from(userId));

    // Find the user to add by email
    const email = Email.create(dto.email);
    const userToAdd = await this.userRepository.findByEmail(email);
    if (!userToAdd) throw new UserNotFoundError(dto.email);

    if (org.hasMember(userToAdd.id)) {
      throw new MemberAlreadyExistsError(userToAdd.id.toString(), 'organization');
    }

    const member = org.addMember(userToAdd.id, dto.role);
    await this.organizationRepository.save(org);
    await this.eventDispatcher.dispatchBatch(org.domainEvents);

    return {
      id: member.id.toString(),
      userId: member.userId.toString(),
      email: dto.email,
      firstName: userToAdd.firstName,
      lastName: userToAdd.lastName,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  /**
   * Remove a member from the organization.
   */
  async removeMember(orgId: string, memberId: string, userId: string): Promise<void> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    this.ensureOwnerOrAdmin(org, UserId.from(userId));

    const member = org.members.find((m) => m.id.toString() === memberId);
    if (!member) throw new Error('Member not found');

    // Cannot remove the last owner
    const ownerCount = org.members.filter((m) => m.role === Role.OWNER).length;
    if (member.role === Role.OWNER && ownerCount <= 1) {
      throw new CannotRemoveLastOwnerError();
    }

    org.removeMember(member.id);
    await this.organizationRepository.save(org);
    await this.eventDispatcher.dispatchBatch(org.domainEvents);
  }

  /**
   * Change a member's role.
   */
  async changeRole(
    orgId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    this.ensureOwnerOrAdmin(org, UserId.from(userId));

    const member = org.members.find((m) => m.id.toString() === memberId);
    if (!member) throw new Error('Member not found');

    // Cannot change the last owner's role
    if (member.role === Role.OWNER && dto.role !== Role.OWNER) {
      const ownerCount = org.members.filter((m) => m.role === Role.OWNER).length;
      if (ownerCount <= 1) {
        throw new CannotRemoveLastOwnerError();
      }
    }

    org.changeRole(member.id, dto.role);
    await this.organizationRepository.save(org);

    const user = await this.userRepository.findById(member.userId);

    return {
      id: member.id.toString(),
      userId: member.userId.toString(),
      email: user?.email.toString() ?? '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      role: dto.role,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  /**
   * Get members of an organization.
   */
  async getMembers(orgId: string, userId: string): Promise<MemberResponseDto[]> {
    const org = await this.organizationRepository.findById(OrganizationId.from(orgId));
    if (!org) throw new OrganizationNotFoundError(orgId);

    this.ensureMember(org, UserId.from(userId));

    const memberResponses: MemberResponseDto[] = [];

    for (const member of org.members) {
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

  private ensureMember(org: Organization, userId: UserId): void {
    if (!org.hasMember(userId)) {
      throw new NotOrganizationMemberError();
    }
  }

  private ensureOwner(org: Organization, userId: UserId): void {
    if (!org.ownerId.equals(userId)) {
      throw new NotOrganizationOwnerError();
    }
  }

  private ensureOwnerOrAdmin(org: Organization, userId: UserId): void {
    const member = org.getMemberByUserId(userId);
    if (!member) throw new NotOrganizationMemberError();
    if (!member.hasRole(Role.ADMIN)) {
      throw new InsufficientPermissionsError('admin or owner');
    }
    if (member.role !== Role.OWNER && member.role !== Role.ADMIN) {
      throw new InsufficientPermissionsError('admin or owner');
    }
  }

  private toResponse(org: Organization): OrganizationResponseDto {
    return {
      id: org.id.toString(),
      name: org.name,
      slug: org.slug,
      description: org.description,
      ownerId: org.ownerId.toString(),
      memberCount: org.members.length,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100) || 'organization'
    );
  }
}
