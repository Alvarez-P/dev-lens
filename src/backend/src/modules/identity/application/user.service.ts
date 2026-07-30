import { Injectable } from '@nestjs/common';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { OrganizationRepository } from '../infrastructure/persistence/repositories/organization.repository';
import { WorkspaceRepository } from '../infrastructure/persistence/repositories/workspace.repository';
import { User } from '../domain/user.entity';
import { UserId } from '../domain/user-id.vo';
import { Email } from '../domain/email.vo';
import { UserNotFoundError } from '../domain/identity-errors';
import { UpdateProfileDto, UserProfileResponseDto } from './dto/user.dto';
import { OrganizationResponseDto } from './dto/organization.dto';
import { WorkspaceResponseDto } from './dto/workspace.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  /**
   * Find a user by ID.
   */
  async findById(id: string): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(UserId.from(id));
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return this.toProfileResponse(user);
  }

  /**
   * Find a user by email.
   */
  async findByEmail(email: string): Promise<UserProfileResponseDto | null> {
    const emailVo = Email.create(email);
    const user = await this.userRepository.findByEmail(emailVo);
    if (!user) return null;
    return this.toProfileResponse(user);
  }

  /**
   * Update the user's profile.
   */
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

  /**
   * Get all organizations the user belongs to.
   */
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

  /**
   * Get all workspaces the user belongs to.
   */
  async getUserWorkspaces(userId: string): Promise<WorkspaceResponseDto[]> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return this.workspaceRepository.findByUserId(UserId.from(userId));
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
