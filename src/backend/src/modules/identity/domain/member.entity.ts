import { Entity } from '../../../shared/domain/entity';
import { Identifier } from '../../../shared/domain/identifier';
import { UserId } from './user-id.vo';
import { Role } from './role.enum';
import { randomUUID } from 'crypto';

/**
 * MemberId — typed identifier for members.
 */
export class MemberId extends Identifier<string> {
  static create(): MemberId {
    return new MemberId(randomUUID());
  }

  static from(value: string): MemberId {
    return new MemberId(value);
  }
}

/**
 * Member Entity.
 *
 * Represents a user's membership within an organization or workspace.
 * This is an Entity (not an aggregate root) — it belongs to either
 * an Organization or Workspace aggregate.
 *
 * Members link users to organizations/workspaces with a specific role.
 */
export class Member extends Entity<MemberId> {
  constructor(
    id: MemberId,
    public readonly userId: UserId,
    public role: Role,
    public readonly joinedAt: Date,
  ) {
    super(id);
  }

  /**
   * Factory: creates a new Member.
   */
  static create(userId: UserId, role: Role = Role.MEMBER): Member {
    return new Member(MemberId.create(), userId, role, new Date());
  }

  /**
   * Changes the member's role.
   */
  changeRole(newRole: Role): void {
    this.role = newRole;
  }

  /**
   * Returns true if the member has at least the given role level.
   * Hierarchy: OWNER > ADMIN > MEMBER > VIEWER
   */
  hasRole(minimumRole: Role): boolean {
    const hierarchy: Record<Role, number> = {
      [Role.VIEWER]: 0,
      [Role.MEMBER]: 1,
      [Role.ADMIN]: 2,
      [Role.OWNER]: 3,
    };

    return hierarchy[this.role] >= hierarchy[minimumRole];
  }
}
