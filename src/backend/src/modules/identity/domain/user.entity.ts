import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { UserId } from './user-id.vo';
import { Email } from './email.vo';
import { UserRegisteredEvent, UserLoggedInEvent, EmailVerifiedEvent } from './domain-events';

/**
 * User Aggregate Root.
 *
 * Represents a registered user in the system.
 * Manages authentication state: password, email verification, refresh tokens.
 */
export class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    public readonly email: Email,
    public passwordHash: string,
    public firstName: string,
    public lastName: string,
    public avatarUrl: string | null,
    public isEmailVerified: boolean,
    public refreshTokenHash: string | null,
    public lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  /**
   * Factory: creates a new user and publishes UserRegisteredEvent.
   */
  static create(email: Email, passwordHash: string, firstName: string, lastName: string): User {
    const user = new User(
      UserId.create(),
      email,
      passwordHash,
      firstName,
      lastName,
      null, // avatarUrl
      false, // isEmailVerified
      null, // refreshTokenHash
      null, // lastLoginAt
      new Date(),
      new Date(),
    );

    user.addDomainEvent(
      new UserRegisteredEvent(
        user.id.toString(),
        user.email.toString(),
        user.firstName,
        user.lastName,
      ),
    );

    return user;
  }

  /**
   * Reconstitute a User from persistence.
   * Does NOT publish domain events.
   */
  static reconstitute(
    id: UserId,
    email: Email,
    passwordHash: string,
    firstName: string,
    lastName: string,
    avatarUrl: string | null,
    isEmailVerified: boolean,
    refreshTokenHash: string | null,
    lastLoginAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): User {
    return new User(
      id,
      email,
      passwordHash,
      firstName,
      lastName,
      avatarUrl,
      isEmailVerified,
      refreshTokenHash,
      lastLoginAt,
      createdAt,
      updatedAt,
    );
  }

  /**
   * Marks the user's email as verified.
   */
  verifyEmail(): void {
    if (this.isEmailVerified) {
      return; // Idempotent
    }

    this.isEmailVerified = true;
    this.updatedAt = new Date();

    this.addDomainEvent(new EmailVerifiedEvent(this.id.toString(), this.email.toString()));
  }

  /**
   * Updates the user's profile information.
   */
  updateProfile(dto: { firstName?: string; lastName?: string; avatarUrl?: string | null }): void {
    if (dto.firstName !== undefined) {
      this.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      this.lastName = dto.lastName;
    }
    if (dto.avatarUrl !== undefined) {
      this.avatarUrl = dto.avatarUrl;
    }
    this.updatedAt = new Date();
  }

  /**
   * Sets (or rotates) the refresh token hash after successful login/token refresh.
   */
  setRefreshToken(refreshTokenHash: string): void {
    this.refreshTokenHash = refreshTokenHash;
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Clears the refresh token hash (used on logout).
   */
  clearRefreshToken(): void {
    this.refreshTokenHash = null;
    this.updatedAt = new Date();
  }

  /**
   * Records a successful login and publishes UserLoggedInEvent.
   */
  recordLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();

    this.addDomainEvent(new UserLoggedInEvent(this.id.toString(), this.email.toString()));
  }

  /**
   * Updates the password hash.
   */
  updatePassword(newHash: string): void {
    this.passwordHash = newHash;
    this.updatedAt = new Date();
  }

  /**
   * Full name getter.
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
