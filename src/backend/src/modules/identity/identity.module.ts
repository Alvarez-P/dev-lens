import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '../../config/config.module';
import { ConfigService } from '../../config/config.service';

// ─── Domain ─────────────────────────────────────────────────────

// ─── Application Services ───────────────────────────────────────
import { AuthService } from './application/auth.service';
import { UserService } from './application/user.service';
import { OrganizationService } from './application/organization.service';
import { WorkspaceService } from './application/workspace.service';

// ─── Infrastructure — Auth ─────────────────────────────────────
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { PasswordService } from './infrastructure/auth/password.service';

// ─── Infrastructure — Persistence ──────────────────────────────
import { UserTypeOrmEntity } from './infrastructure/persistence/typeorm/user.typeorm-entity';
import { OrganizationTypeOrmEntity } from './infrastructure/persistence/typeorm/organization.typeorm-entity';
import { WorkspaceTypeOrmEntity } from './infrastructure/persistence/typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from './infrastructure/persistence/typeorm/member.typeorm-entity';

import { UserRepository } from './infrastructure/persistence/repositories/user.repository';
import { OrganizationRepository } from './infrastructure/persistence/repositories/organization.repository';
import { WorkspaceRepository } from './infrastructure/persistence/repositories/workspace.repository';
import { MemberRepository } from './infrastructure/persistence/repositories/member.repository';

// ─── Controllers ────────────────────────────────────────────────
import { AuthController } from './infrastructure/controllers/auth.controller';
import { UsersController } from './infrastructure/controllers/users.controller';
import { OrganizationsController } from './infrastructure/controllers/organizations.controller';
import { WorkspacesController } from './infrastructure/controllers/workspaces.controller';

const typeOrmEntities = [
  UserTypeOrmEntity,
  OrganizationTypeOrmEntity,
  WorkspaceTypeOrmEntity,
  MemberTypeOrmEntity,
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
          expiresIn: 900, // 15 minutes (overridden per-token in AuthService)
        },
      }),
    }),
    ConfigModule,
  ],
  controllers: [AuthController, UsersController, OrganizationsController, WorkspacesController],
  providers: [
    // Application services
    AuthService,
    UserService,
    OrganizationService,
    WorkspaceService,

    // Repositories
    UserRepository,
    OrganizationRepository,
    WorkspaceRepository,
    MemberRepository,

    // Auth infrastructure
    JwtStrategy,
    PasswordService,
  ],
  exports: [
    AuthService,
    UserService,
    OrganizationService,
    WorkspaceService,
    UserRepository,
    OrganizationRepository,
    WorkspaceRepository,
  ],
})
export class IdentityModule {}
