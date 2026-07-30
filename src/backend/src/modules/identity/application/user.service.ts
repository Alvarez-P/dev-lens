import { Injectable } from '@nestjs/common';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { ExternalIdentityRepository } from '../infrastructure/persistence/repositories/external-identity.repository';
import { OrganizationRepository } from '../infrastructure/persistence/repositories/organization.repository';
import { WorkspaceRepository } from '../infrastructure/persistence/repositories/workspace.repository';
import { User } from '../domain/user.entity';
import { UserId } from '../domain/user-id.vo';
import { Email } from '../domain/email.vo';
import { ExternalIdentityId } from '../domain/external-identity.entity';
import { UserNotFoundError, CannotUnlinkSoleIdentity } from '../domain/identity-errors';
import { UpdateProfileDto, UserProfileResponseDto } from './dto/user.dto';
import { OrganizationResponseDto } from './dto/organization.dto';
import { WorkspaceResponseDto } from './dto/workspace.dto';
import { LinkedIdentityDto } from './dto/oauth.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly externalIdentityRepository: ExternalIdentityRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async findById(id: string): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(UserId.from(id));
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return this.toProfileResponse(user);
  }

  async findByEmail(email: string): Promise<UserProfileResponseDto | null> {
    const emailVo = Email.create(email);
    const user = await this.userRepository.findByEmail(emailVo);
    if (!user) return null;
    return this.toProfileResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.updateProfile({
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl,
    });

    await this.userRepository.save(user);
    return this.toProfileResponse(user);
  }

  async getUserOrganizations(userId: string): Promise<OrganizationResponseDto[]> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const orgs = await this.organizationRepository.findByUserId(UserId.from(userId));
    return orgs.map((org) => ({
      id: org.id.toString(),
      name: org.name,
      slug: org.slug,
      description: org.description,
      ownerId: org.ownerId.toString(),
      memberCount: org.members.length,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    }));
  }

  async getUserWorkspaces(userId: string): Promise<WorkspaceResponseDto[]> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return this.workspaceRepository.findByUserId(UserId.from(userId));
  }

  async getLinkedIdentities(userId: string): Promise<LinkedIdentityDto[]> {
    const identities = await this.externalIdentityRepository.findByUserId(userId);
    return identities.map((identity) => ({
      id: identity.id.toString(),
      provider: identity.provider,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      linkedAt: identity.createdAt.toISOString(),
    }));
  }

  async unlinkIdentity(userId: string, identityId: string): Promise<void> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const identity = await this.externalIdentityRepository.findById(
      ExternalIdentityId.from(identityId),
    );
    if (!identity || identity.userId !== userId) {
      throw new UserNotFoundError(identityId);
    }

    // Sole auth guard: if user has no password and only one identity, reject
    const remainingIdentities = await this.externalIdentityRepository.findByUserId(userId);
    if (!user.passwordHash && remainingIdentities.length <= 1) {
      throw new CannotUnlinkSoleIdentity();
    }

    await this.externalIdentityRepository.delete(ExternalIdentityId.from(identityId));
  }

  private toProfileResponse(user: User): UserProfileResponseDto {
    return {
      id: user.id.toString(),
      email: user.email.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
