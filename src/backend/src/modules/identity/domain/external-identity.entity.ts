import { Entity } from '../../../shared/domain/entity';
import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class ExternalIdentityId extends Identifier<string> {
  static create(): ExternalIdentityId {
    return new ExternalIdentityId(randomUUID());
  }

  static from(value: string): ExternalIdentityId {
    return new ExternalIdentityId(value);
  }
}

export interface CreateExternalIdentityDto {
  userId: string;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface ReconstituteExternalIdentityDto {
  id: string;
  userId: string;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ExternalIdentity extends Entity<ExternalIdentityId> {
  private constructor(
    id: ExternalIdentityId,
    public readonly userId: string,
    public readonly provider: string,
    public readonly externalId: string,
    public accessToken: string,
    public refreshToken: string | null,
    public tokenExpiresAt: Date | null,
    public displayName: string | null,
    public avatarUrl: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static create(dto: CreateExternalIdentityDto): ExternalIdentity {
    return new ExternalIdentity(
      ExternalIdentityId.create(),
      dto.userId,
      dto.provider,
      dto.externalId,
      dto.accessToken,
      dto.refreshToken ?? null,
      dto.tokenExpiresAt ?? null,
      dto.displayName ?? null,
      dto.avatarUrl ?? null,
      new Date(),
      new Date(),
    );
  }

  static reconstitute(dto: ReconstituteExternalIdentityDto): ExternalIdentity {
    return new ExternalIdentity(
      ExternalIdentityId.from(dto.id),
      dto.userId,
      dto.provider,
      dto.externalId,
      dto.accessToken,
      dto.refreshToken ?? null,
      dto.tokenExpiresAt ?? null,
      dto.displayName ?? null,
      dto.avatarUrl ?? null,
      dto.createdAt,
      dto.updatedAt,
    );
  }

  updateTokens(accessToken: string, refreshToken?: string | null, expiresAt?: Date | null): void {
    this.accessToken = accessToken;
    if (refreshToken !== undefined) {
      this.refreshToken = refreshToken ?? null;
    }
    if (expiresAt !== undefined) {
      this.tokenExpiresAt = expiresAt ?? null;
    }
    this.updatedAt = new Date();
  }
}
