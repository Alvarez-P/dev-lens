import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from '../domain/external-identity-provider.interface';
import { ExternalIdentity } from '../domain/external-identity.entity';
import { User } from '../domain/user.entity';
import { Email } from '../domain/email.vo';
import { UserId } from '../domain/user-id.vo';

import { OAuthController } from '../infrastructure/controllers/oauth.controller';
import { AuthController } from '../infrastructure/controllers/auth.controller';
import { OAuthService } from '../application/oauth.service';
import { AuthService } from '../application/auth.service';
import { OAuthStateService } from '../infrastructure/auth/oauth-state.service';
import { ProviderRegistry } from '../infrastructure/auth/provider-registry';
import { PasswordService } from '../infrastructure/auth/password.service';

import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { ExternalIdentityRepository } from '../infrastructure/persistence/repositories/external-identity.repository';
import { TokenEncryptionService } from '../infrastructure/encryption/token-encryption.service';

import { ConfigService } from '../../../config/config.service';

// ──────────────────────────────────────────────
// Mock Provider: returns controlled profile data
// ──────────────────────────────────────────────
class MockOAuthProvider implements ExternalIdentityProvider {
  readonly provider = 'mock';
  private profile: ExternalUserProfile;

  constructor(profileOverride?: Partial<ExternalUserProfile>) {
    this.profile = {
      externalId: 'mock_external_1',
      email: 'mockuser@example.com',
      displayName: 'Mock User',
      avatarUrl: 'https://example.com/avatar.png',
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      ...profileOverride,
    };
  }

  getProviderName(): string {
    return 'mock';
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    return `https://mock.oauth/authorize?state=${state}&redirect_uri=${redirectUri}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return this.profile;
  }
}

describe('OAuth Integration (3 resolution paths)', () => {
  let app: INestApplication;
  let userRepo: jest.Mocked<UserRepository>;
  let identityRepo: jest.Mocked<ExternalIdentityRepository>;
  let providerRegistry: ProviderRegistry;
  let oauthStateService: OAuthStateService;
  let jwtService: JwtService;

  const defaultConfig = {
    auth: {
      jwtSecret: 'integration-test-jwt-secret',
      jwtExpiresIn: '15m',
      jwtRefreshExpiresIn: '7d',
    },
    oauth: {
      github: {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        callbackUrl: 'http://localhost:3001/api/v1/auth/oauth/mock/callback',
      },
      tokenEncryptionKey: 'integration-test-encryption-key',
    },
  } as unknown as ConfigService;

  function createApp(providers?: {
    userRepo?: Partial<jest.Mocked<UserRepository>>;
    identityRepo?: Partial<jest.Mocked<ExternalIdentityRepository>>;
  }) {
    userRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      existsByEmail: jest.fn(),
      ...providers?.userRepo,
    } as unknown as jest.Mocked<UserRepository>;

    identityRepo = {
      findByProvider: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      ...providers?.identityRepo,
    } as unknown as jest.Mocked<ExternalIdentityRepository>;

    providerRegistry = new ProviderRegistry();
    jwtService = new JwtService({ secret: defaultConfig.auth.jwtSecret });
    oauthStateService = new OAuthStateService(jwtService);
  }

  async function initApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, OAuthController],
      providers: [
        // Application services
        AuthService,
        OAuthService,
        PasswordService,
        JwtService,

        // Mock dependencies
        { provide: UserRepository, useValue: userRepo },
        { provide: ExternalIdentityRepository, useValue: identityRepo },
        { provide: ProviderRegistry, useValue: providerRegistry },
        { provide: OAuthStateService, useValue: oauthStateService },
        {
          provide: TokenEncryptionService,
          useValue: {
            encrypt: jest.fn().mockReturnValue('encrypted'),
            decrypt: jest.fn().mockReturnValue('decrypted'),
          },
        },
        { provide: ConfigService, useValue: defaultConfig },
        { provide: 'DOMAIN_EVENT_DISPATCHER', useValue: { dispatchBatch: jest.fn() } },
      ],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    return app;
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  // ─── Path A: Identity match ──────────────────────────────────────
  it('Path A — should resolve by existing identity and return JWT', async () => {
    createApp();

    // Existing external identity with linked user
    const existingIdentity = ExternalIdentity.create({
      userId: 'existing-user-uuid',
      provider: 'mock',
      externalId: 'mock_external_1',
      accessToken: 'old_token',
      displayName: 'Mock User',
    });
    identityRepo.findByProvider.mockResolvedValue(existingIdentity);

    const existingUser = User.reconstitute(
      UserId.from('existing-user-uuid'),
      Email.create('mockuser@example.com'),
      'hashed',
      'Mock',
      'User',
      null,
      true,
      null,
      null,
      new Date('2024-01-01'),
      new Date('2024-01-01'),
    );
    userRepo.findById.mockResolvedValue(existingUser);

    providerRegistry.register(new MockOAuthProvider());
    app = await initApp();
    await app.init();

    const stateToken = oauthStateService.sign('test-state');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/mock/callback?code=valid_code&state=${stateToken}`)
      .expect(302);

    expect(res.headers.location).toContain('oauth=success');
    expect(res.headers.location).toContain('accessToken=');
    expect(identityRepo.findByProvider).toHaveBeenCalledWith('mock', 'mock_external_1');
    expect(userRepo.findById).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'existing-user-uuid' }),
    );
  });

  // ─── Path B: Email match → link identity ─────────────────────────
  it('Path B — should resolve by email, link identity, and return JWT', async () => {
    createApp();

    // No existing identity
    identityRepo.findByProvider.mockResolvedValue(null);

    // But user exists by email
    const existingUser = User.reconstitute(
      UserId.from('email-user-uuid'),
      Email.create('mockuser@example.com'),
      'hashed',
      'Mock',
      'User',
      null,
      true,
      null,
      null,
      new Date('2024-01-01'),
      new Date('2024-01-01'),
    );
    userRepo.findByEmail.mockResolvedValue(existingUser);

    providerRegistry.register(new MockOAuthProvider());
    app = await initApp();
    await app.init();

    const stateToken = oauthStateService.sign('test-state');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/mock/callback?code=valid_code&state=${stateToken}`)
      .expect(302);

    expect(res.headers.location).toContain('oauth=success');
    expect(identityRepo.findByProvider).toHaveBeenCalledWith('mock', 'mock_external_1');
    expect(userRepo.findByEmail).toHaveBeenCalled();
    expect(identityRepo.save).toHaveBeenCalled();
    const savedIdentity = identityRepo.save.mock.calls[0][0] as ExternalIdentity;
    expect(savedIdentity.userId).toBe('email-user-uuid');
  });

  // ─── Path C: No match → provision new user ───────────────────────
  it('Path C — should provision a new user when no match exists', async () => {
    createApp();

    // No existing identity
    identityRepo.findByProvider.mockResolvedValue(null);
    // No user by email
    userRepo.findByEmail.mockResolvedValue(null);
    // Save succeeds
    userRepo.save.mockResolvedValue();

    providerRegistry.register(new MockOAuthProvider());
    app = await initApp();
    await app.init();

    const stateToken = oauthStateService.sign('test-state');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/mock/callback?code=valid_code&state=${stateToken}`)
      .expect(302);

    expect(res.headers.location).toContain('oauth=success');
    expect(userRepo.save).toHaveBeenCalled();
    expect(identityRepo.save).toHaveBeenCalled();

    // Verify the provisioned user has correct fields
    const savedUser = userRepo.save.mock.calls[0][0] as User;
    expect(savedUser.email.toString()).toBe('mockuser@example.com');
    expect(savedUser.isEmailVerified).toBe(true);
  });

  // ─── Tampered state ──────────────────────────────────────────────
  it('should reject tampered state with 400', async () => {
    createApp();
    providerRegistry.register(new MockOAuthProvider());
    app = await initApp();
    await app.init();

    await request(app.getHttpServer())
      .get('/api/v1/auth/oauth/mock/callback?code=code&state=tampered-state-value')
      .expect(400);
  });

  // ─── Duplicate identity ──────────────────────────────────────────
  it('should handle duplicate identity gracefully', async () => {
    createApp();

    // Existing identity exists (simulating "already linked")
    const existingIdentity = ExternalIdentity.create({
      userId: 'existing-user-uuid',
      provider: 'mock',
      externalId: 'mock_external_1',
      accessToken: 'old_token',
      displayName: 'Mock User',
    });
    identityRepo.findByProvider.mockResolvedValue(existingIdentity);

    const existingUser = User.reconstitute(
      UserId.from('existing-user-uuid'),
      Email.create('mockuser@example.com'),
      'hashed',
      'Mock',
      'User',
      null,
      true,
      null,
      null,
      new Date('2024-01-01'),
      new Date('2024-01-01'),
    );
    userRepo.findById.mockResolvedValue(existingUser);

    providerRegistry.register(new MockOAuthProvider());
    app = await initApp();
    await app.init();

    const stateToken = oauthStateService.sign('test-state');

    // This should succeed (Path A) — duplicate identity means it already exists,
    // which maps to the identity match path
    const res = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/mock/callback?code=valid_code&state=${stateToken}`)
      .expect(302);

    expect(res.headers.location).toContain('oauth=success');
  });

  // ─── Backward comp: existing auth endpoints unchanged ─────────────
  it('should not break POST /auth/login backward compatibility', async () => {
    createApp();

    userRepo.findByEmail.mockResolvedValue(null);

    providerRegistry.register(new MockOAuthProvider());
    app = await initApp();
    await app.init();

    // Login with non-existent user should still fail properly
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'somepassword' })
      .expect(401);

    expect(res.body).toHaveProperty('message', 'Invalid email or password');
    expect(res.body).toHaveProperty('statusCode', 401);
  });
});
