import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { RepositoryTypeOrmEntity } from '../typeorm/repository.typeorm-entity';
import {
  Repository as DomainRepository,
  RepositoryId,
  RepositoryUrl,
  GitProvider,
} from '../../../domain';
import { RepositoryStatus } from '../../../domain/repository-status.enum';
import { PaginatedResult } from '../../../../../shared/infrastructure/pagination/paginated-result';

@Injectable()
export class RepositoryRepository {
  constructor(
    @InjectRepository(RepositoryTypeOrmEntity)
    private readonly ormRepo: TypeOrmRepository<RepositoryTypeOrmEntity>,
  ) {}

  async findById(id: RepositoryId): Promise<DomainRepository | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByOwnerId(
    ownerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<DomainRepository>> {
    const [entities, total] = await this.ormRepo.findAndCount({
      where: { ownerId },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = entities.map((e) => this.toDomain(e));
    return new PaginatedResult(data, total, page, limit);
  }

  async save(repo: DomainRepository): Promise<void> {
    const entity = this.toPersistence(repo);
    await this.ormRepo.save(entity);
  }

  async delete(id: RepositoryId): Promise<void> {
    await this.ormRepo.delete(id.toString());
  }

  async exists(id: RepositoryId): Promise<boolean> {
    const count = await this.ormRepo.count({ where: { id: id.toString() } });
    return count > 0;
  }

  private toDomain(entity: RepositoryTypeOrmEntity): DomainRepository {
    return DomainRepository.reconstitute(
      RepositoryId.from(entity.id),
      entity.name,
      RepositoryUrl.create(entity.url),
      entity.provider as GitProvider,
      entity.defaultBranch,
      entity.workspaceId,
      entity.organizationId,
      entity.ownerId,
      entity.status as RepositoryStatus,
      entity.credentialId,
      entity.lastSyncAt,
      entity.lastSyncCommit,
      entity.lastSyncError,
      entity.sizeBytes,
      entity.fileCount,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private toPersistence(repo: DomainRepository): RepositoryTypeOrmEntity {
    const entity = new RepositoryTypeOrmEntity();
    entity.id = repo.id.toString();
    entity.name = repo.name;
    entity.url = repo.url.toString();
    entity.provider = repo.provider;
    entity.defaultBranch = repo.defaultBranch;
    entity.status = repo.status;
    entity.workspaceId = repo.workspaceId;
    entity.organizationId = repo.organizationId;
    entity.ownerId = repo.ownerId;
    entity.credentialId = repo.credentialId;
    entity.lastSyncAt = repo.lastSyncAt;
    entity.lastSyncCommit = repo.lastSyncCommit;
    entity.lastSyncError = repo.lastSyncError;
    entity.sizeBytes = repo.sizeBytes ?? null;
    entity.fileCount = repo.fileCount ?? null;
    entity.createdAt = repo.createdAt;
    entity.updatedAt = repo.updatedAt;
    return entity;
  }
}
