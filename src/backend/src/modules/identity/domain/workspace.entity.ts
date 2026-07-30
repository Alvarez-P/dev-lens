import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { WorkspaceId } from './workspace-id.vo';
import { OrganizationId } from './organization-id.vo';
import { UserId } from './user-id.vo';
import { Member, MemberId } from './member.entity';
import { Role } from './role.enum';
import { WorkspaceCreatedEvent } from './domain-events';

/**
 * Workspace Aggregate Root.
 *
 * Represents a workspace within an organization.
 * Workspaces own repositories, analyses, and other resources.
 * Members are inherited from the parent organization by default,
 * with optional workspace-specific roles.
 */
export class Workspace extends AggregateRoot<WorkspaceId> {
  private readonly _members: Member[] = [];

  private constructor(
    id: WorkspaceId,
    public name: string,
    public slug: string,
    public description: string | null,
    public readonly organizationId: OrganizationId,
    public readonly createdAt: Date,
    public updatedAt: Date,
    members: Member[] = [],
  ) {
    super(id);
    this._members = members;
  }

  /**
   * Factory: creates a new workspace within an organization.
   */
  static create(
    name: string,
    slug: string,
    description: string | null,
    organizationId: OrganizationId,
    creatorId: UserId,
  ): Workspace {
    const workspace = new Workspace(
      WorkspaceId.create(),
      name,
      slug,
      description,
      organizationId,
      new Date(),
      new Date(),
    );

    // Creator becomes an admin of the workspace
    workspace._members.push(Member.create(creatorId, Role.ADMIN));

    workspace.addDomainEvent(
      new WorkspaceCreatedEvent(
        workspace.id.toString(),
        workspace.name,
        workspace.slug,
        workspace.organizationId.toString(),
      ),
    );

    return workspace;
  }

  /**
   * Reconstructs an existing workspace (from persistence).
   * Does NOT publish domain events.
   */
  static reconstitute(
    id: WorkspaceId,
    name: string,
    slug: string,
    description: string | null,
    organizationId: OrganizationId,
    createdAt: Date,
    updatedAt: Date,
    members: Member[],
  ): Workspace {
    return new Workspace(
      id,
      name,
      slug,
      description,
      organizationId,
      createdAt,
      updatedAt,
      members,
    );
  }

  get members(): ReadonlyArray<Member> {
    return [...this._members];
  }

  /**
   * Updates workspace details.
   */
  updateDetails(dto: { name?: string; description?: string | null }): void {
    if (dto.name !== undefined) {
      this.name = dto.name;
    }
    if (dto.description !== undefined) {
      this.description = dto.description;
    }
    this.updatedAt = new Date();
  }

  /**
   * Adds a member to the workspace.
   */
  addMember(userId: UserId, role: Role = Role.MEMBER): Member {
    const exists = this._members.some((m) => m.userId.equals(userId));
    if (exists) {
      throw new Error(`User "${userId}" is already a member of this workspace`);
    }

    const member = Member.create(userId, role);
    this._members.push(member);
    this.updatedAt = new Date();

    return member;
  }

  /**
   * Removes a member from the workspace.
   */
  removeMember(memberId: MemberId): void {
    const index = this._members.findIndex((m) => m.id.equals(memberId));
    if (index === -1) {
      throw new Error('Member not found');
    }

    const member = this._members[index];

    // Prevent removing the last admin
    if (member.role === Role.ADMIN) {
      const adminCount = this._members.filter(
        (m) => m.role === Role.ADMIN || m.role === Role.OWNER,
      ).length;
      if (adminCount <= 1) {
        throw new Error('Cannot remove the last admin of the workspace');
      }
    }

    this._members.splice(index, 1);
    this.updatedAt = new Date();
  }

  /**
   * Checks if the given user is a member of this workspace.
   */
  hasMember(userId: UserId): boolean {
    return this._members.some((m) => m.userId.equals(userId));
  }

  /**
   * Gets a member by user ID.
   */
  getMemberByUserId(userId: UserId): Member | undefined {
    return this._members.find((m) => m.userId.equals(userId));
  }
}
