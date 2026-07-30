import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth.dto';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { ExternalIdentityRepository } from '../infrastructure/persistence/repositories/external-identity.repository';
import { ProviderRegistry } from '../infrastructure/auth/provider-registry';
import { TokenEncryptionService } from '../infrastructure/encryption/token-encryption.service';
import { ExternalIdentity } from '../domain/external-identity.entity';
import { User } from '../domain/user.entity';
import { Email } from '../domain/email.vo';
import { UserId } from '../domain/user-id.vo';
import { IdentityAlreadyLinked } from '../domain/identity-errors';
import { QueryFailedError } from 'typeorm';

@Injectable()
export class OAuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly externalIdentityRepository: ExternalIdentityRepository,
    private readonly providerRegistry: ProviderRegistry,
    private readonly tokenEncryptionService: TokenEncryptionService,
    private readonly authService: AuthService,
  ) {}

  private async saveIdentity(identity: ExternalIdentity): Promise<void> {
    try {
      await this.externalIdentityRepository.save(identity);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as QueryFailedError).driverError) {
        const driverError = (error as QueryFailedError).driverError as unknown as { code: string };
        if (driverError.code === '23505') {
          throw new IdentityAlreadyLinked(identity.provider, identity.externalId);
        }
      }
      throw error;
    }
  }

  async authenticateWithProvider(
    providerName: string,
    code: string,
    redirectUri: string,
  ): Promise<AuthResponseDto> {
    const provider = this.providerRegistry.resolve(providerName);
    const profile = await provider.exchangeCode(code, redirectUri);

    // Path A: Match by existing identity (provider + externalId)
    const existingIdentity = await this.externalIdentityRepository.findByProvider(
      providerName,
      profile.externalId,
    );

    if (existingIdentity) {
      existingIdentity.updateTokens(profile.accessToken, profile.refreshToken);
      await this.externalIdentityRepository.save(existingIdentity);

      const user = await this.userRepository.findById(UserId.from(existingIdentity.userId));
      if (!user) {
        throw new Error(`User ${existingIdentity.userId} not found for external identity`);
      }

      return this.authService.buildAuthResponse(user);
    }

    const email = Email.create(profile.email);

    // Path B: Match by email — link identity to existing user
    const userByEmail = await this.userRepository.findByEmail(email);

    if (userByEmail) {
      const identity = ExternalIdentity.create({
        userId: userByEmail.id.toString(),
        provider: providerName,
        externalId: profile.externalId,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      });
      await this.saveIdentity(identity);

      return this.authService.buildAuthResponse(userByEmail);
    }

    // Path C: No match — provision new user
    const nameParts = profile.displayName.split(' ');
    const firstName = nameParts[0] || profile.displayName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const newUser = User.create(email, '', firstName, lastName);
    if (profile.avatarUrl) {
      newUser.updateProfile({ avatarUrl: profile.avatarUrl });
    }
    newUser.verifyEmail();
    await this.userRepository.save(newUser);

    const newIdentity = ExternalIdentity.create({
      userId: newUser.id.toString(),
      provider: providerName,
      externalId: profile.externalId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
    await this.saveIdentity(newIdentity);

    return this.authService.buildAuthResponse(newUser);
  }
}
