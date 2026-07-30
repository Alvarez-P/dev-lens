import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '../../config/config.module';

// ─── Domain ──────────────────────────────────────────────────────

// ─── Application Services ────────────────────────────────────────
import { RepositoryService } from './application/repository.service';
import { CredentialService } from './application/credential.service';
import { SyncService } from './application/sync.service';

// ─── Infrastructure — Persistence ────────────────────────────────
import { RepositoryTypeOrmEntity } from './infrastructure/persistence/typeorm/repository.typeorm-entity';
import { SnapshotTypeOrmEntity } from './infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { CredentialTypeOrmEntity } from './infrastructure/persistence/typeorm/credential.typeorm-entity';

import { RepositoryRepository } from './infrastructure/persistence/repositories/repository.repository';
import { SnapshotRepository } from './infrastructure/persistence/repositories/snapshot.repository';
import { CredentialRepository } from './infrastructure/persistence/repositories/credential.repository';

// ─── Infrastructure — Git ────────────────────────────────────────
import { GitService } from './infrastructure/git/git.service';
import { GitHubProvider } from './infrastructure/git/github.provider';
import { GitLabProvider } from './infrastructure/git/gitlab.provider';
import { BitbucketProvider } from './infrastructure/git/bitbucket.provider';
import { GenericProvider } from './infrastructure/git/generic.provider';
import { GitProviderFactory } from './infrastructure/git/provider.factory';

// ─── Infrastructure — Encryption ────────────────────────────────
import { CredentialEncryptionService } from './infrastructure/encryption/credential-encryption.service';

// ─── Infrastructure — Jobs ───────────────────────────────────────
import { SyncJobProcessor } from './infrastructure/jobs/sync.job-processor';
import { CloneJobProcessor } from './infrastructure/jobs/clone.job-processor';

// ─── Controllers ────────────────────────────────────────────────
import { RepositoriesController } from './infrastructure/controllers/repositories.controller';
import { CredentialsController } from './infrastructure/controllers/credentials.controller';

const typeOrmEntities = [RepositoryTypeOrmEntity, SnapshotTypeOrmEntity, CredentialTypeOrmEntity];

const gitProviders = [GitHubProvider, GitLabProvider, BitbucketProvider, GenericProvider];

const persistenceRepositories = [RepositoryRepository, SnapshotRepository, CredentialRepository];

const jobs = [SyncJobProcessor, CloneJobProcessor];

@Module({
  imports: [
    TypeOrmModule.forFeature(typeOrmEntities),
    BullModule.registerQueue({ name: 'repository-sync' }, { name: 'repository-clone' }),
    ConfigModule,
  ],
  controllers: [RepositoriesController, CredentialsController],
  providers: [
    // Application services
    RepositoryService,
    CredentialService,
    SyncService,

    // Persistence repositories
    ...persistenceRepositories,

    // Git providers
    ...gitProviders,
    GitProviderFactory,
    GitService,

    // Encryption
    CredentialEncryptionService,

    // Job processors
    ...jobs,
  ],
  exports: [RepositoryService, SyncService, CredentialService, RepositoryRepository],
})
export class RepositoriesModule {}
