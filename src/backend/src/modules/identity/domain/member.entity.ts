import { Entity } from '../../../shared/domain/entity';
import { Identifier } from '../../../shared/domain/identifier';
import { UserId } from './user-id.vo';
import { Role } from './role.enum';
import { randomUUID } from 'crypto';

export class MemberId extends Identifier<string> {
  static create(): MemberId {
    return new MemberId(randomUUID());
  }

  static from(value: string): MemberId {
    return new MemberId(value);
  }
}

export class Member extends Entity<MemberId> {
  constructor(
    id: MemberId,
    public readonly userId: UserId,
    public role: Role,
    public readonly joinedAt: Date,
  ) {
    super(id);
  }

  static create(userId: UserId, role: Role = Role.MEMBER): Member {
    return new Member(MemberId.create(), userId, role, new Date());
  }

  changeRole(newRole: Role): void {
    this.role = newRole;
  }

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
