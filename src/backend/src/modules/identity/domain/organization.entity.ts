import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { OrganizationId } from './organization-id.vo';
import { UserId } from './user-id.vo';
import { Member, MemberId } from './member.entity';
import { Role } from './role.enum';
import { OrganizationCreatedEvent, MemberAddedEvent, MemberRemovedEvent } from './domain-events';

export class Organization extends AggregateRoot<OrganizationId> {
  private readonly _members: Member[] = [];

  private constructor(
    id: OrganizationId,
    public name: string,
    public slug: string,
    public description: string | null,
    public readonly ownerId: UserId,
    public readonly createdAt: Date,
    public updatedAt: Date,
    members: Member[] = [],
  ) {
    super(id);
    this._members = members;
  }

  static create(
    name: string,
    slug: string,
    description: string | null,
    ownerId: UserId,
  ): Organization {
    const org = new Organization(
      OrganizationId.create(),
      name,
      slug,
      description,
      ownerId,
      new Date(),
      new Date(),
    );

    org._members.push(Member.create(ownerId, Role.OWNER));

    org.addDomainEvent(
      new OrganizationCreatedEvent(org.id.toString(), org.name, org.slug, org.ownerId.toString()),
    );

    return org;
  }

  static reconstitute(
    id: OrganizationId,
    name: string,
    slug: string,
    description: string | null,
    ownerId: UserId,
    createdAt: Date,
    updatedAt: Date,
    members: Member[],
  ): Organization {
    return new Organization(id, name, slug, description, ownerId, createdAt, updatedAt, members);
  }

  get members(): ReadonlyArray<Member> {
    return [...this._members];
  }

  updateDetails(dto: { name?: string; description?: string | null }): void {
    if (dto.name !== undefined) {
      this.name = dto.name;
    }
    if (dto.description !== undefined) {
      this.description = dto.description;
    }
    this.updatedAt = new Date();
  }

  addMember(userId: UserId, role: Role = Role.MEMBER): Member {
    const exists = this._members.some((m) => m.userId.equals(userId));
    if (exists) {
      throw new Error(`User "${userId}" is already a member of this organization`);
    }

    const member = Member.create(userId, role);
    this._members.push(member);
    this.updatedAt = new Date();

    this.addDomainEvent(new MemberAddedEvent(this.id.toString(), userId.toString(), role));

    return member;
  }

  removeMember(memberId: MemberId): void {
    const index = this._members.findIndex((m) => m.id.equals(memberId));
    if (index === -1) {
      throw new Error('Member not found');
    }

    const member = this._members[index];

    if (member.role === Role.OWNER) {
      const ownerCount = this._members.filter((m) => m.role === Role.OWNER).length;
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the last owner of the organization');
      }
    }

    this._members.splice(index, 1);
    this.updatedAt = new Date();

    this.addDomainEvent(new MemberRemovedEvent(this.id.toString(), member.userId.toString()));
  }

  changeRole(memberId: MemberId, newRole: Role): void {
    const member = this._members.find((m) => m.id.equals(memberId));
    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === Role.OWNER && newRole !== Role.OWNER) {
      const ownerCount = this._members.filter((m) => m.role === Role.OWNER).length;
      if (ownerCount <= 1) {
        throw new Error('Cannot change the role of the last owner');
      }
    }

    member.changeRole(newRole);
    this.updatedAt = new Date();
  }

  getMemberByUserId(userId: UserId): Member | undefined {
    return this._members.find((m) => m.userId.equals(userId));
  }

  hasMember(userId: UserId): boolean {
    return this._members.some((m) => m.userId.equals(userId));
  }
}
