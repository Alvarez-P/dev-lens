import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { AnalysisTypeOrmEntity } from '../typeorm/analysis.typeorm-entity';
import {
  Analysis,
  AnalysisId,
  AnalysisStatus,
  IrProject,
  IrProjectJson,
  Language,
} from '../../../domain';
import { SnapshotId, RepositoryId } from '../../../../repositories/domain';

@Injectable()
export class AnalysisRepository {
  constructor(
    @InjectRepository(AnalysisTypeOrmEntity)
    private readonly ormRepo: TypeOrmRepository<AnalysisTypeOrmEntity>,
  ) {}

  async save(analysis: Analysis): Promise<void> {
    await this.ormRepo.save(this.toPersistence(analysis));
  }

  async findById(id: AnalysisId): Promise<Analysis | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });

    return entity ? this.toDomain(entity) : null;
  }

  async findBySnapshotId(snapshotId: SnapshotId): Promise<Analysis | null> {
    const entity = await this.ormRepo.findOne({ where: { snapshotId: snapshotId.toString() } });

    return entity ? this.toDomain(entity) : null;
  }

  async findLatestByRepo(repositoryId: RepositoryId): Promise<Analysis | null> {
    const entity = await this.ormRepo.findOne({
      where: { repositoryId: repositoryId.toString() },
      order: { createdAt: 'DESC' },
    });

    return entity ? this.toDomain(entity) : null;
  }

  private toDomain(entity: AnalysisTypeOrmEntity): Analysis {
    return Analysis.reconstitute(
      AnalysisId.from(entity.id),
      SnapshotId.from(entity.snapshotId),
      RepositoryId.from(entity.repositoryId),
      entity.status as AnalysisStatus,
      entity.ir ? this.deserializeIr(entity.ir) : null,
      entity.fileManifest,
      entity.reuseRatio,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private deserializeIr(json: IrProjectJson): IrProject {
    return IrProject.create({
      name: json.name,
      rootPath: json.rootPath,
      language: Language.create(json.language.name, json.language.extension),
      packages: json.packages,
      dependencies: json.dependencies,
      relationships: json.relationships,
    });
  }

  private toPersistence(analysis: Analysis): AnalysisTypeOrmEntity {
    const entity = new AnalysisTypeOrmEntity();
    entity.id = analysis.id.toString();
    entity.snapshotId = analysis.snapshotId.toString();
    entity.repositoryId = analysis.repositoryId.toString();
    entity.status = analysis.status;
    entity.ir = analysis.ir ? analysis.ir.toJSON() : null;
    entity.fileManifest = analysis.fileManifest;
    entity.reuseRatio = analysis.reuseRatio;
    entity.createdAt = analysis.createdAt;
    entity.updatedAt = analysis.updatedAt;

    return entity;
  }
}
