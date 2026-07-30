import { Module, Inject, Optional } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '../../config/config.module';
import { ConfigService } from '../../config/config.service';

import { AuthService } from './application/auth.service';
import { UserService } from './application/user.service';
import { OrganizationService } from './application/organization.service';
import { WorkspaceService } from './application/workspace.service';
import { OAuthService } from './application/oauth.service';

import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { PasswordService } from './infrastructure/auth/password.service';
import { OAuthStateService } from './infrastructure/auth/oauth-state.service';
import { ProviderRegistry } from './infrastructure/auth/provider-registry';
import { GithubOAuthProvider } from './infrastructure/auth/github-oauth.provider';

import { TokenEncryptionService } from './infrastructure/encryption/token-encryption.service';

import { UserTypeOrmEntity } from './infrastructure/persistence/typeorm/user.typeorm-entity';
import { OrganizationTypeOrmEntity } from './infrastructure/persistence/typeorm/organization.typeorm-entity';
import { WorkspaceTypeOrmEntity } from './infrastructure/persistence/typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from './infrastructure/persistence/typeorm/member.typeorm-entity';
import { ExternalIdentityTypeormEntity } from './infrastructure/persistence/typeorm/external-identity.typeorm-entity';

import { UserRepository } from './infrastructure/persistence/repositories/user.repository';
import { OrganizationRepository } from './infrastructure/persistence/repositories/organization.repository';
import { WorkspaceRepository } from './infrastructure/persistence/repositories/workspace.repository';
import { MemberRepository } from './infrastructure/persistence/repositories/member.repository';
import { ExternalIdentityRepository } from './infrastructure/persistence/repositories/external-identity.repository';

import { AuthController } from './infrastructure/controllers/auth.controller';
import { UsersController } from './infrastructure/controllers/users.controller';
import { OrganizationsController } from './infrastructure/controllers/organizations.controller';
import { WorkspacesController } from './infrastructure/controllers/workspaces.controller';
import { OAuthController } from './infrastructure/controllers/oauth.controller';

const typeOrmEntities = [
  UserTypeOrmEntity,
  OrganizationTypeOrmEntity,
  WorkspaceTypeOrmEntity,
  MemberTypeOrmEntity,
  ExternalIdentityTypeormEntity,
];

@Module({
  imports: [
    TypeOrmModule.forFeature(typeOrmEntities),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.auth.jwtSecret,
        signOptions: {
          expiresIn: 900,
        },
      }),
    }),
    ConfigModule,
  ],
  controllers: [
    AuthController,
    UsersController,
    OrganizationsController,
    WorkspacesController,
    OAuthController,
  ],
  providers: [
    AuthService,
    UserService,
    OrganizationService,
    WorkspaceService,
    OAuthService,

    UserRepository,
    OrganizationRepository,
    WorkspaceRepository,
    MemberRepository,
    ExternalIdentityRepository,

    JwtStrategy,
    PasswordService,
    TokenEncryptionService,
    {
      provide: ProviderRegistry,
      inject: [{ token: GithubOAuthProvider, optional: true }],
      useFactory: (githubProvider: GithubOAuthProvider | null) => {
        const registry = new ProviderRegistry();
        if (githubProvider) {
          registry.register(githubProvider);
        }
        return registry;
      },
    },
    {
      provide: 'OAUTH_JWT_SERVICE',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new JwtService({
          secret: configService.oauth.stateSecret,
          signOptions: { expiresIn: 300 },
        }),
    },
    {
      provide: OAuthStateService,
      inject: ['OAUTH_JWT_SERVICE'],
      useFactory: (jwtService: JwtService) => new OAuthStateService(jwtService),
    },
    {
      provide: GithubOAuthProvider,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const github = configService.oauth.github;
        if (!github.clientId) {
          return null;
        }
        return new GithubOAuthProvider(github);
      },
    },
    {
      provide: 'OAUTH_PROVIDERS_CONFIGURED',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => !!configService.oauth.github.clientId,
    },
  ],
  exports: [
    AuthService,
    UserService,
    OrganizationService,
    WorkspaceService,
    OAuthService,
    UserRepository,
    OrganizationRepository,
    WorkspaceRepository,
    ExternalIdentityRepository,
  ],
})
export class IdentityModule {}
