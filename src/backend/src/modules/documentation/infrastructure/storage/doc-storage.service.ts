import { Injectable } from '@nestjs/common';
import { MinioService, DOCS_BUCKET } from './minio.service';
import { DocType } from '../../domain/doc-type.enum';
import type { RenderedArtifact } from '../renderers/renderer.interface';

/**
 * Minimal repository shape consumed for key derivation. Only the identity and
 * the org fallback chain are used — mirrors `Repository` (repositories context):
 * `organizationId` and `workspaceId` are nullable, `ownerId` is always present.
 */
export interface DocStorageRepositoryRef {
  id: string;
  organizationId: string | null;
  workspaceId: string | null;
  ownerId: string;
}

export interface StoredDoc {
  minioKey: string;
  latestKey: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Stores rendered documentation artifacts in MinIO under the RFC-011 §11 key
 * scheme: `{org}/{repo}/{commitSha}/{docType}.{format}` plus a `latest/` copy
 * (documentation-storage R2/R3). The `latest` pointer is a separate object copy
 * (MinIO has no symlinks) written alongside the commit-specific object so it can
 * be retrieved without querying commit history (R3).
 *
 * The org component resolves via the fallback chain
 * `organizationId ?? workspaceId ?? ownerId` (design decision B) because the
 * repository entity's org/workspace fields are nullable — the key must always
 * resolve.
 */
@Injectable()
export class DocStorageService {
  constructor(private readonly minioService: MinioService) {}

  /** Org component of the key: `organizationId ?? workspaceId ?? ownerId`. */
  resolveOrg(repository: DocStorageRepositoryRef): string {
    return repository.organizationId ?? repository.workspaceId ?? repository.ownerId;
  }

  /** Commit-specific key: `{org}/{repo}/{commitSha}/{docType}.{format}` (R2). */
  buildKey(
    repository: DocStorageRepositoryRef,
    commitSha: string,
    docType: DocType,
    formatExt: string,
  ): string {
    const org = this.resolveOrg(repository);
    return `${org}/${repository.id}/${commitSha}/${docType}.${formatExt}`;
  }

  /** Latest-pointer key: `{org}/{repo}/latest/{docType}.{format}` (R3). */
  buildLatestKey(repository: DocStorageRepositoryRef, docType: DocType, formatExt: string): string {
    const org = this.resolveOrg(repository);
    return `${org}/${repository.id}/latest/${docType}.${formatExt}`;
  }

  /**
   * Write the artifact at the commit-specific key and a `latest/` copy
   * (documentation-storage R2/R3). Both objects are written in the same call so
   * the latest pointer stays in sync with the commit-specific artifact.
   */
  async store(
    repository: DocStorageRepositoryRef,
    commitSha: string,
    docType: DocType,
    artifact: RenderedArtifact,
  ): Promise<StoredDoc> {
    const minioKey = this.buildKey(repository, commitSha, docType, artifact.ext);
    const latestKey = this.buildLatestKey(repository, docType, artifact.ext);

    await this.minioService.putObject(DOCS_BUCKET, minioKey, artifact.buffer, artifact.contentType);
    await this.minioService.putObject(
      DOCS_BUCKET,
      latestKey,
      artifact.buffer,
      artifact.contentType,
    );

    return {
      minioKey,
      latestKey,
      sizeBytes: artifact.buffer.length,
      contentType: artifact.contentType,
    };
  }

  /** Presigned GET URL for an artifact key, 1-hour default expiry (api R3). */
  presignDownload(minioKey: string, expires: number = 3600): Promise<string> {
    return this.minioService.presignGetObject(DOCS_BUCKET, minioKey, expires);
  }
}
