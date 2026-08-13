import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../identity/infrastructure/auth/jwt-auth.guard';
import { RepoMembershipGuard } from '../../../knowledge-graph/guards/repo-membership.guard';
import { RepositoryRepository } from '../../../repositories/infrastructure/persistence/repositories/repository.repository';
import { RepositoryId } from '../../../repositories/domain/repository-id.vo';
import { DocType } from '../../domain/doc-type.enum';
import { DocArtifactRepository } from '../persistence/repositories/doc-artifact.repository';
import { DocStorageService } from '../storage/doc-storage.service';
import { DocumentationJobData } from '../../application/documentation.service';
import { DOCUMENTATION_QUEUE } from '../../documentation.tokens';
import { contentTypeForFormat, downloadFilename } from './doc-file-meta';

/** Request body for generate/regenerate — docTypes is optional (api R1/R6). */
export class GenerateDocsDto {
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(DocType), { each: true })
  docTypes?: DocType[];
}

/**
 * Documentation REST API (documentation-api R1–R7). Every endpoint sits behind
 * JwtAuthGuard + RepoMembershipGuard (R7). Generate/regenerate enqueue BullMQ
 * jobs and return the jobId for polling `GET .../docs/jobs/:jobId` (progress
 * via `job.updateProgress`, design decision B). Delete is owner/admin-only and
 * atomic — the MinIO object is removed before the row so a storage failure
 * keeps the metadata row intact (R5).
 */
@ApiTags('Documentation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RepoMembershipGuard)
@Controller({ path: 'repositories/:repoId/docs', version: '1' })
export class DocumentationController {
  constructor(
    @InjectQueue(DOCUMENTATION_QUEUE)
    private readonly documentationQueue: Queue,
    private readonly artifactRepository: DocArtifactRepository,
    private readonly storageService: DocStorageService,
    private readonly repositoryRepository: RepositoryRepository,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue documentation generation for a repository' })
  @ApiResponse({ status: 202, description: 'Generation job enqueued' })
  @ApiResponse({ status: 400, description: 'Invalid doc type' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Not a member of the repository' })
  async generate(
    @Param('repoId') repoId: string,
    @Body() dto: GenerateDocsDto,
  ): Promise<{ jobId: string }> {
    const jobId = await this.enqueue(repoId, dto.docTypes, false);
    return { jobId };
  }

  @Get()
  @ApiOperation({ summary: 'List documentation artifacts for a repository' })
  @ApiResponse({ status: 200, description: 'Artifacts ordered by generatedAt descending' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Not a member of the repository' })
  async list(@Param('repoId') repoId: string) {
    const artifacts = await this.artifactRepository.findByRepository(repoId);
    return {
      success: true,
      data: artifacts.map((artifact) => ({
        id: artifact.id.toString(),
        docType: artifact.docType,
        format: artifact.format,
        sizeBytes: artifact.sizeBytes,
        generatedAt: artifact.generatedAt,
        templateVersion: artifact.templateVersion,
        commitSha: artifact.commitSha,
      })),
    };
  }

  @Get(':docId')
  @ApiOperation({ summary: 'Get artifact metadata with a presigned download URL' })
  @ApiResponse({ status: 200, description: 'Full artifact metadata plus downloadUrl' })
  @ApiResponse({ status: 404, description: 'Artifact not found' })
  async getMetadata(@Param('repoId') repoId: string, @Param('docId') docId: string) {
    const artifact = await this.findScoped(docId, repoId);
    const downloadUrl = await this.storageService.presignDownload(artifact.minioKey);

    return {
      success: true,
      data: {
        id: artifact.id.toString(),
        repositoryId: artifact.repositoryId,
        commitSha: artifact.commitSha,
        docType: artifact.docType,
        format: artifact.format,
        sizeBytes: artifact.sizeBytes,
        generatedAt: artifact.generatedAt,
        templateVersion: artifact.templateVersion,
        aiModelVersion: artifact.aiModelVersion,
        status: artifact.status,
        downloadUrl,
      },
    };
  }

  @Get(':docId/download')
  @ApiOperation({ summary: 'Stream the artifact file from MinIO to the client' })
  @ApiResponse({ status: 200, description: 'Raw artifact bytes with attachment headers' })
  @ApiResponse({ status: 404, description: 'Artifact or MinIO object not found' })
  async download(
    @Param('repoId') repoId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ): Promise<void> {
    const artifact = await this.findScoped(docId, repoId);

    let stream;
    try {
      stream = await this.storageService.getObjectStream(artifact.minioKey);
    } catch (error) {
      throw new NotFoundException(`Artifact file missing for "${docId}"`);
    }

    res.setHeader('Content-Type', contentTypeForFormat(artifact.format));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadFilename(artifact.docType, artifact.format)}"`,
    );
    stream.pipe(res);
  }

  @Delete(':docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an artifact (repository owner or admin only)' })
  @ApiResponse({ status: 204, description: 'Artifact deleted' })
  @ApiResponse({ status: 403, description: 'Not the repository owner' })
  @ApiResponse({ status: 404, description: 'Artifact not found' })
  async remove(
    @Param('repoId') repoId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    const artifact = await this.findScoped(docId, repoId);
    await this.assertOwner(repoId, user.userId);

    // Atomic delete (api R5): object first — a MinIO failure throws here and
    // the metadata row is left intact.
    await this.storageService.deleteObject(artifact.minioKey);
    await this.artifactRepository.remove(artifact);
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Force regeneration, bypassing idempotency' })
  @ApiResponse({ status: 202, description: 'Forced regeneration job enqueued' })
  @ApiResponse({ status: 400, description: 'Invalid doc type' })
  async regenerate(
    @Param('repoId') repoId: string,
    @Body() dto: GenerateDocsDto,
  ): Promise<{ jobId: string }> {
    const jobId = await this.enqueue(repoId, dto.docTypes, true);
    return { jobId };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll a generation job status and progress' })
  @ApiResponse({ status: 200, description: 'Job state, progress, and failure reason' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.documentationQueue.getJob(jobId);
    if (job === null || job === undefined) {
      throw new NotFoundException(`Documentation job "${jobId}" not found`);
    }

    return {
      success: true,
      data: {
        jobId: job.id,
        state: await job.getState(),
        progress: job.progress,
        failedReason: job.failedReason,
      },
    };
  }

  /**
   * Enqueue a generation job. The job id doubles as the `analysisId` so the
   * pipeline's progress events (`jobId = analysisId`) line up with the queue
   * job id that `GET .../jobs/:jobId` polls (design decision B).
   */
  private async enqueue(
    repoId: string,
    docTypes: DocType[] | undefined,
    force: boolean,
  ): Promise<string> {
    const jobId = randomUUID();
    const jobData: DocumentationJobData = { repositoryId: repoId, analysisId: jobId };
    if (docTypes !== undefined) {
      jobData.docTypes = docTypes;
    }
    if (force) {
      jobData.force = true;
    }

    await this.documentationQueue.add('generate-documentation', jobData, { jobId });
    return jobId;
  }

  /** Load an artifact scoped to the repository, or 404. */
  private async findScoped(docId: string, repoId: string) {
    const artifact = await this.artifactRepository.findById(docId);
    if (artifact === null || artifact.repositoryId !== repoId) {
      throw new NotFoundException(`Documentation artifact "${docId}" not found`);
    }
    return artifact;
  }

  /** Owner/admin check for destructive operations (api R5 non-owner → 403). */
  private async assertOwner(repoId: string, userId: string): Promise<void> {
    const repository = await this.repositoryRepository.findById(RepositoryId.from(repoId));
    if (repository === null || repository.ownerId !== userId) {
      throw new ForbiddenException(`Only the repository owner can delete documentation artifacts`);
    }
  }
}
