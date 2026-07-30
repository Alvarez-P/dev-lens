import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { SnapshotTypeOrmEntity } from '../typeorm/snapshot.typeorm-entity';
import {
  Snapshot as DomainSnapshot,
  SnapshotId,
  RepositoryId,
  SnapshotStatus,
} from '../../../domain';
import { PaginatedResult } from '../../../../../shared/infrastructure/pagination/paginated-result';

@Injectable()
export class SnapshotRepository {
  constructor(
    @InjectRepository(SnapshotTypeOrmEntity)
    private readonly ormRepo: TypeOrmRepository<SnapshotTypeOrmEntity>,
  ) {}

  async findById(repositoryId: string, snapshotId: string): Promise<DomainSnapshot | null> {
    const entity = await this.ormRepo.findOne({
      where: { id: snapshotId, repositoryId },
    });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByRepositoryId(
    repositoryId: RepositoryId,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<DomainSnapshot>> {
    const [entities, total] = await this.ormRepo.findAndCount({
      where: { repositoryId: repositoryId.toString() },
      order: { syncTimestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = entities.map((e) => this.toDomain(e));
    return new PaginatedResult(data, total, page, limit);
  }

  async save(snapshot: DomainSnapshot): Promise<void> {
    const entity = this.toPersistence(snapshot);
    await this.ormRepo.save(entity);
  }

  async deleteByRepositoryId(repositoryId: RepositoryId): Promise<void> {
    await this.ormRepo.delete({ repositoryId: repositoryId.toString() });
  }

  private toDomain(entity: SnapshotTypeOrmEntity): DomainSnapshot {
    return DomainSnapshot.reconstitute(
      SnapshotId.from(entity.id),
      RepositoryId.from(entity.repositoryId),
      entity.commitSha,
      entity.branch,
      entity.author,
      entity.commitMessage,
      entity.commitTimestamp,
      entity.syncTimestamp,
      entity.fileCount,
      entity.sizeBytes,
      entity.status as SnapshotStatus,
    );
  }

  private toPersistence(snapshot: DomainSnapshot): SnapshotTypeOrmEntity {
    const entity = new SnapshotTypeOrmEntity();
    entity.id = snapshot.id.toString();
    entity.repositoryId = snapshot.repositoryId.toString();
    entity.commitSha = snapshot.commitSha;
    entity.branch = snapshot.branch;
    entity.author = snapshot.author;
    entity.commitMessage = snapshot.commitMessage;
    entity.commitTimestamp = snapshot.commitTimestamp;
    entity.syncTimestamp = snapshot.syncTimestamp;
    entity.fileCount = snapshot.fileCount;
    entity.sizeBytes = snapshot.sizeBytes;
    entity.status = snapshot.status;
    entity.createdAt = new Date();
    return entity;
  }
}
