import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from './oauth.service';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { ExternalIdentityRepository } from '../infrastructure/persistence/repositories/external-identity.repository';
import { ProviderRegistry } from '../infrastructure/auth/provider-registry';
import { TokenEncryptionService } from '../infrastructure/encryption/token-encryption.service';
import { AuthService } from './auth.service';
import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from '../domain/external-identity-provider.interface';
import { ExternalIdentity } from '../domain/external-identity.entity';
import { User } from '../domain/user.entity';
import { Email } from '../domain/email.vo';
import { UserId } from '../domain/user-id.vo';
import { IdentityAlreadyLinked } from '../domain/identity-errors';
import { QueryFailedError } from 'typeorm';

class MockGithubProvider implements ExternalIdentityProvider {
  readonly provider = 'github';
  getProviderName(): string {
    return 'github';
  }
  getAuthorizationUrl(state: string, redirectUri: string): string {
    return `https://github.com/login/oauth/authorize?state=${state}&redirect_uri=${redirectUri}`;
  }
  async exchangeCode(_code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return {
      externalId: 'gh_12345',
      email: 'octocat@github.com',
      displayName: 'Octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      accessToken: 'gho_mock_token_123',
      refreshToken: 'ghr_mock_refresh_456',
    };
  }
}

class MockGitlabProvider implements ExternalIdentityProvider {
  readonly provider = 'gitlab';
  getProviderName(): string {
    return 'gitlab';
  }
  getAuthorizationUrl(state: string, redirectUri: string): string {
    return `https://gitlab.com/oauth/authorize?state=${state}&redirect_uri=${redirectUri}`;
  }
  async exchangeCode(_code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return {
      externalId: 'gl_789',
      email: 'user@gitlab.com',
      displayName: 'GitLab User',
      accessToken: 'glpat_mock_token',
    };
  }
}

describe('OAuthService', () => {
  let service: OAuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let identityRepo: jest.Mocked<ExternalIdentityRepository>;
  let providerRegistry: ProviderRegistry;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    accessToken: 'jwt_access_token',
    refreshToken: 'jwt_refresh_token',
    expiresIn: 900,
    user: {
      id: 'user-id-1',
      email: 'octocat@github.com',
      firstName: 'Octocat',
      lastName: '',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      isEmailVerified: true,
      createdAt: '2024-01-15T10:00:00.000Z',
    },
  };

  beforeEach(async () => {
    userRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    identityRepo = {
      findByProvider: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<ExternalIdentityRepository>;

    authService = {
      buildAuthResponse: jest.fn().mockResolvedValue(mockAuthResponse),
    } as unknown as jest.Mocked<AuthService>;

    providerRegistry = new ProviderRegistry();
    providerRegistry.register(new MockGithubProvider());
    providerRegistry.register(new MockGitlabProvider());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: UserRepository, useValue: userRepo },
        { provide: ExternalIdentityRepository, useValue: identityRepo },
        { provide: ProviderRegistry, useValue: providerRegistry },
        {
          provide: TokenEncryptionService,
          useValue: {
            encrypt: jest.fn().mockReturnValue('encrypted'),
            decrypt: jest.fn().mockReturnValue('decrypted'),
          },
        },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
  });

  describe('authenticateWithProvider', () => {
    it('should resolve by existing identity (Path A)', async () => {
      const existingIdentity = ExternalIdentity.create({
        userId: 'existing-user-id',
        provider: 'github',
        externalId: 'gh_12345',
        accessToken: 'old_token',
        displayName: 'Octocat',
      });
      identityRepo.findByProvider.mockResolvedValue(existingIdentity);

      const existingUser = User.reconstitute(
        UserId.from('existing-user-id'),
        Email.create('octocat@github.com'),
        'hashed_password',
        'Octocat',
        '',
        'https://avatars.githubusercontent.com/u/583231',
        true,
        'refresh_hash',
        new Date('2024-01-10T00:00:00Z'),
        new Date('2024-01-10T00:00:00Z'),
        new Date('2024-01-10T00:00:00Z'),
      );
      userRepo.findById.mockResolvedValue(existingUser);

      const result = await service.authenticateWithProvider(
        'github',
        'auth_code',
        'http://localhost:3001/api/v1/auth/oauth/github/callback',
      );

      expect(identityRepo.findByProvider).toHaveBeenCalledWith('github', 'gh_12345');
      expect(identityRepo.save).toHaveBeenCalled();
      expect(userRepo.findById).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'existing-user-id' }),
      );
      expect(authService.buildAuthResponse).toHaveBeenCalledWith(existingUser);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should resolve by email match and link identity (Path B)', async () => {
      identityRepo.findByProvider.mockResolvedValue(null);

      const existingUser = User.reconstitute(
        UserId.from('email-matched-user-id'),
        Email.create('octocat@github.com'),
        'hashed_password',
        'Octocat',
        '',
        null,
        true,
        null,
        null,
        new Date('2024-01-10T00:00:00Z'),
        new Date('2024-01-10T00:00:00Z'),
      );
      userRepo.findByEmail.mockResolvedValue(existingUser);

      const result = await service.authenticateWithProvider(
        'github',
        'auth_code',
        'http://localhost:3001/api/v1/auth/oauth/github/callback',
      );

      expect(identityRepo.findByProvider).toHaveBeenCalledWith('github', 'gh_12345');
      expect(userRepo.findByEmail).toHaveBeenCalled();
      expect(identityRepo.save).toHaveBeenCalled();
      expect(authService.buildAuthResponse).toHaveBeenCalledWith(existingUser);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should provision a new user when no match exists (Path C)', async () => {
      identityRepo.findByProvider.mockResolvedValue(null);
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.save.mockResolvedValue();

      const result = await service.authenticateWithProvider(
        'github',
        'auth_code',
        'http://localhost:3001/api/v1/auth/oauth/github/callback',
      );

      expect(userRepo.save).toHaveBeenCalled();
      expect(identityRepo.save).toHaveBeenCalled();
      expect(authService.buildAuthResponse).toHaveBeenCalled();
      expect(result).toEqual(mockAuthResponse);

      const savedUser = userRepo.save.mock.calls[0][0] as User;
      expect(savedUser.email.toString()).toBe('octocat@github.com');
      expect(savedUser.isEmailVerified).toBe(true);
    });

    it('should throw when provider is not registered', async () => {
      await expect(
        service.authenticateWithProvider('bitbucket', 'code', 'http://localhost:3001/callback'),
      ).rejects.toThrow(/not found/i);
    });
    it('should throw IdentityAlreadyLinked on duplicate (provider, externalId)', async () => {
      identityRepo.findByProvider.mockResolvedValue(null);

      const existingUser = User.reconstitute(
        UserId.from('email-matched-user-id'),
        Email.create('octocat@github.com'),
        'hashed_password',
        'Octocat',
        '',
        null,
        true,
        null,
        null,
        new Date('2024-01-10T00:00:00Z'),
        new Date('2024-01-10T00:00:00Z'),
      );
      userRepo.findByEmail.mockResolvedValue(existingUser);

      const dbError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      Object.defineProperty(dbError, 'driverError', { value: { code: '23505' } });
      identityRepo.save.mockRejectedValue(dbError);

      await expect(
        service.authenticateWithProvider(
          'github',
          'auth_code',
          'http://localhost:3001/api/v1/auth/oauth/github/callback',
        ),
      ).rejects.toThrow(IdentityAlreadyLinked);
    });
  });
});
