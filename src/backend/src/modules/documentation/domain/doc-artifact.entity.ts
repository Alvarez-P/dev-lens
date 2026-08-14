import { randomUUID } from 'crypto';
import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Identifier } from '../../../shared/domain/identifier';
import { DocType } from './doc-type.enum';
import { DocFormat } from './doc-format.enum';
import { DocBuildStatus } from './doc-build-status.enum';

export class DocArtifactId extends Identifier<string> {
  static create(): DocArtifactId {
    return new DocArtifactId(randomUUID());
  }

  static from(value: string): DocArtifactId {
    return new DocArtifactId(value);
  }
}

/**
 * Metadata row for one stored documentation artifact (documentation-storage
 * R4). The aggregate carries the full metadata plus a build lifecycle status;
 * the idempotency check queries `(repositoryId, commitSha, docType,
 * templateVersion)` before generation (generation R4).
 */
export class DocArtifact extends AggregateRoot<DocArtifactId> {
  private constructor(
    id: DocArtifactId,
    public readonly repositoryId: string,
    public readonly commitSha: string,
    public readonly docType: DocType,
    public readonly format: DocFormat,
    public minioKey: string,
    public sizeBytes: number,
    public generatedAt: Date,
    public readonly templateVersion: string,
    public aiModelVersion: string | null,
    public status: DocBuildStatus,
  ) {
    super(id);
  }

  static create(
    repositoryId: string,
    commitSha: string,
    docType: DocType,
    format: DocFormat,
    templateVersion: string,
  ): DocArtifact {
    return new DocArtifact(
      DocArtifactId.create(),
      repositoryId,
      commitSha,
      docType,
      format,
      '',
      0,
      new Date(),
      templateVersion,
      null,
      DocBuildStatus.BUILDING,
    );
  }

  static reconstitute(
    id: DocArtifactId,
    repositoryId: string,
    commitSha: string,
    docType: DocType,
    format: DocFormat,
    minioKey: string,
    sizeBytes: number,
    generatedAt: Date,
    templateVersion: string,
    aiModelVersion: string | null,
    status: DocBuildStatus,
  ): DocArtifact {
    return new DocArtifact(
      id,
      repositoryId,
      commitSha,
      docType,
      format,
      minioKey,
      sizeBytes,
      generatedAt,
      templateVersion,
      aiModelVersion,
      status,
    );
  }

  /** Idempotency key match (generation R4). */
  matches(
    repositoryId: string,
    commitSha: string,
    docType: DocType,
    templateVersion: string,
  ): boolean {
    return (
      this.repositoryId === repositoryId &&
      this.commitSha === commitSha &&
      this.docType === docType &&
      this.templateVersion === templateVersion
    );
  }

  complete(minioKey: string, sizeBytes: number, aiModelVersion: string | null): void {
    if (this.status !== DocBuildStatus.BUILDING) {
      throw new Error('DocArtifact can only complete from BUILDING status');
    }
    if (sizeBytes < 0) {
      throw new Error('DocArtifact sizeBytes must not be negative');
    }
    if (!minioKey.trim()) {
      throw new Error('DocArtifact minioKey must not be empty');
    }

    this.minioKey = minioKey;
    this.sizeBytes = sizeBytes;
    this.generatedAt = new Date();
    this.aiModelVersion = aiModelVersion;
    this.status = DocBuildStatus.COMPLETED;
  }

  fail(): void {
    if (this.status !== DocBuildStatus.BUILDING) {
      throw new Error('DocArtifact can only fail from BUILDING status');
    }
    this.status = DocBuildStatus.FAILED;
  }

  skip(): void {
    this.status = DocBuildStatus.SKIPPED;
  }
}
