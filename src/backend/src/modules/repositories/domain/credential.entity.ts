import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { CredentialId } from './credential-id.vo';
import { GitProvider } from './git-provider.enum';

export enum CredentialType {
  PAT = 'PAT',
  SSH_KEY = 'SSH_KEY',
  OAUTH = 'OAUTH',
}

export class Credential extends AggregateRoot<CredentialId> {
  private constructor(
    id: CredentialId,
    public readonly ownerId: string,
    public readonly provider: GitProvider,
    public name: string,
    public readonly encryptedValue: string,
    public readonly type: CredentialType,
    public readonly createdAt: Date,
    public expiresAt: Date | null,
  ) {
    super(id);
  }

  static create(
    ownerId: string,
    provider: GitProvider,
    name: string,
    encryptedValue: string,
    type: CredentialType,
    expiresAt: Date | null = null,
  ): Credential {
    return new Credential(
      CredentialId.create(),
      ownerId,
      provider,
      name,
      encryptedValue,
      type,
      new Date(),
      expiresAt,
    );
  }

  static reconstitute(
    id: CredentialId,
    ownerId: string,
    provider: GitProvider,
    name: string,
    encryptedValue: string,
    type: CredentialType,
    createdAt: Date,
    expiresAt: Date | null,
  ): Credential {
    return new Credential(id, ownerId, provider, name, encryptedValue, type, createdAt, expiresAt);
  }

  updateLabel(newName: string): void {
    this.name = newName;
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt < new Date();
  }
}
