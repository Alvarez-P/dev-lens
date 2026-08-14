import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { DocArtifactEntity } from '../typeorm/doc-artifact.typeorm-entity';
import { DocArtifact, DocArtifactId } from '../../../domain/doc-artifact.entity';
import { DocType } from '../../../domain/doc-type.enum';
import { DocFormat } from '../../../domain/doc-format.enum';
import { DocBuildStatus } from '../../../domain/doc-build-status.enum';

/**
 * Persistence repository for DocArtifact (documentation-storage R4/R5).
 * Mirrors the knowledge-graph GraphRepository / ai enrichment repository
 * pattern: maps between the domain aggregate and the TypeORM entity, and
 * exposes the idempotency-key lookup used by the generation service to skip
 * already-produced `(repositoryId, commitSha, docType, templateVersion)`
 * combinations (R4).
 */
@Injectable()
export class DocArtifactRepository {
  constructor(
    @InjectRepository(DocArtifactEntity)
    private readonly repo: TypeOrmRepository<DocArtifactEntity>,
  ) {}

  async save(artifact: DocArtifact): Promise<void> {
    await this.repo.save(this.toEntity(artifact));
  }

  async findById(id: string): Promise<DocArtifact | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity === null ? null : this.toDomain(entity);
  }

  /**
   * Idempotency check (documentation-storage R4): returns the artifact for a
   * `(repositoryId, commitSha, docType, templateVersion)` combination, or null
   * when generation should proceed.
   */
  async findByIdempotencyKey(
    repositoryId: string,
    commitSha: string,
    docType: DocType,
    templateVersion: string,
  ): Promise<DocArtifact | null> {
    const entity = await this.repo.findOne({
      where: { repositoryId, commitSha, docType, templateVersion },
    });
    return entity === null ? null : this.toDomain(entity);
  }

  /** All artifacts for a repository, newest first (api R2). */
  async findByRepository(repositoryId: string): Promise<DocArtifact[]> {
    const entities = await this.repo.find({
      where: { repositoryId },
      order: { generatedAt: 'DESC' },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  /** Delete the artifact metadata row (api R5). */
  async remove(artifact: DocArtifact): Promise<void> {
    await this.repo.delete({ id: artifact.id.toString() });
  }

  private toEntity(artifact: DocArtifact): DocArtifactEntity {
    const entity = new DocArtifactEntity();
    entity.id = artifact.id.toString();
    entity.repositoryId = artifact.repositoryId;
    entity.commitSha = artifact.commitSha;
    entity.docType = artifact.docType;
    entity.format = artifact.format;
    entity.minioKey = artifact.minioKey;
    entity.sizeBytes = artifact.sizeBytes;
    entity.generatedAt = artifact.generatedAt;
    entity.templateVersion = artifact.templateVersion;
    entity.aiModelVersion = artifact.aiModelVersion;
    entity.status = artifact.status;
    entity.createdAt = artifact.generatedAt;
    return entity;
  }

  private toDomain(entity: DocArtifactEntity): DocArtifact {
    return DocArtifact.reconstitute(
      DocArtifactId.from(entity.id),
      entity.repositoryId,
      entity.commitSha,
      entity.docType as DocType,
      entity.format as DocFormat,
      entity.minioKey,
      entity.sizeBytes,
      entity.generatedAt,
      entity.templateVersion,
      entity.aiModelVersion,
      entity.status as DocBuildStatus,
    );
  }
}
