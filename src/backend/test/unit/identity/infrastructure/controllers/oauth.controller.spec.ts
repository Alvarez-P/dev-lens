import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OAuthController } from '@/modules/identity/infrastructure/controllers/oauth.controller';
import { OAuthService } from '@/modules/identity/application/oauth.service';
import { OAuthStateService } from '@/modules/identity/infrastructure/auth/oauth-state.service';
import { ProviderRegistry } from '@/modules/identity/infrastructure/auth/provider-registry';
import { TokenEncryptionService } from '@/modules/identity/infrastructure/encryption/token-encryption.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@/config/config.service';
import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from '@/modules/identity/domain/external-identity-provider.interface';
import { InvalidOAuthState } from '@/modules/identity/domain/identity-errors';

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
      accessToken: 'mock_gh_mock_token',
    };
  }
}

describe('OAuthController', () => {
  let app: INestApplication;
  let oauthService: jest.Mocked<OAuthService>;
  let oauthStateService: OAuthStateService;
  let providerRegistry: ProviderRegistry;

  const mockAuthResponse = {
    accessToken: 'jwt_access_token_value',
    refreshToken: 'jwt_refresh_token_value',
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

  beforeAll(async () => {
    oauthService = {
      authenticateWithProvider: jest.fn().mockResolvedValue(mockAuthResponse),
    } as unknown as jest.Mocked<OAuthService>;

    providerRegistry = new ProviderRegistry();
    providerRegistry.register(new MockGithubProvider());

    oauthStateService = new OAuthStateService(new JwtService({ secret: 'test-state-secret' }));

    const tokenEncryption = {
      encrypt: jest.fn().mockReturnValue('encrypted_temp_token'),
      decrypt: jest.fn().mockReturnValue(
        JSON.stringify({
          accessToken: 'jwt_access_token_value',
          refreshToken: 'jwt_refresh_token_value',
        }),
      ),
    };

    const configService = {
      oauth: {
        github: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          callbackUrl: 'http://localhost:3001/api/v1/auth/oauth/github/callback',
        },
        tokenEncryptionKey: 'test-encryption-key',
      },
      frontendUrl: 'http://localhost:3000',
      apiBaseUrl: undefined,
      port: 3001,
    } as unknown as ConfigService;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        { provide: OAuthService, useValue: oauthService },
        { provide: OAuthStateService, useValue: oauthStateService },
        { provide: ProviderRegistry, useValue: providerRegistry },
        { provide: TokenEncryptionService, useValue: tokenEncryption },
        { provide: ConfigService, useValue: configService },
        { provide: 'APP_PIPE', useValue: { transform: (v: any) => v } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/auth/oauth/:provider', () => {
    it('should redirect to the provider authorization URL', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/oauth/github').expect(302);

      expect(res.headers.location).toContain('https://github.com/login/oauth/authorize');
      expect(res.headers.location).toContain('state=');
      expect(res.headers.location).toContain('redirect_uri=');
    });

    it('should return 400 for unknown provider', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/oauth/unknown').expect(400);
    });
  });

  describe('GET /api/v1/auth/oauth/:provider/callback', () => {
    it('should exchange code and redirect with JWT', async () => {
      const stateToken = oauthStateService.sign('valid-state-value');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/oauth/github/callback?code=valid_code&state=${stateToken}`)
        .expect(302);

      expect(res.headers.location).toContain('/auth/callback?code=');
      expect(oauthService.authenticateWithProvider).toHaveBeenCalledWith(
        'github',
        'valid_code',
        'http://localhost:3001/api/v1/auth/oauth/github/callback',
      );
    });

    it('should return 400 for invalid state', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/oauth/github/callback?code=code&state=tampered-state')
        .expect(400);
    });

    it('should return 400 for missing code', async () => {
      const stateToken = oauthStateService.sign('valid-state');

      await request(app.getHttpServer())
        .get(`/api/v1/auth/oauth/github/callback?state=${stateToken}`)
        .expect(400);
    });

    it('should return 400 for unknown provider in callback', async () => {
      oauthService.authenticateWithProvider.mockRejectedValueOnce(new InvalidOAuthState());
      const stateToken = oauthStateService.sign('valid-state');

      await request(app.getHttpServer())
        .get(`/api/v1/auth/oauth/unknown/callback?code=code&state=${stateToken}`)
        .expect(400);
    });
  });
});
