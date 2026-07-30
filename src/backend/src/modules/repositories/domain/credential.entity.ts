import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { CredentialId } from './credential-id.vo';
import { GitProvider } from './git-provider.enum';

/**
 * Credential type.
 */
export enum CredentialType {
  PAT = 'PAT',
  SSH_KEY = 'SSH_KEY',
  OAUTH = 'OAUTH',
}

/**
 * Credential Aggregate Root.
 *
 * Stores encrypted credentials for authenticating with git providers.
 * The actual encryption/decryption happens in the infrastructure layer.
 */
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

  /**
   * Factory: creates a new credential.
   */
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

  /**
   * Reconstitute a Credential from persistence.
   */
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

  /**
   * Update the human-readable label.
   */
  updateLabel(newName: string): void {
    this.name = newName;
  }

  /**
   * Check if the credential has expired.
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt < new Date();
  }
}
