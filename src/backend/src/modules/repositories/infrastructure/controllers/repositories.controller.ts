import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RepositoryService } from '../../application/repository.service';
import { JwtAuthGuard } from '../../../identity/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  RepositoryResponseDto,
} from '../../application/dto/repository.dto';
import { SnapshotResponseDto } from '../../application/dto/snapshot.dto';
import { PaginationQueryDto } from '../../../../shared/infrastructure/pagination/pagination.dto';
import { ApiResponse as ApiResponseType } from '../../../../shared/types/common.types';

@ApiTags('Repositories')
@Controller({ path: 'repositories', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RepositoriesController {
  constructor(private readonly repositoryService: RepositoryService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new repository' })
  @ApiResponse({ status: 201, description: 'Repository created', type: RepositoryResponseDto })
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateRepositoryDto,
  ): Promise<ApiResponseType<RepositoryResponseDto>> {
    const result = await this.repositoryService.create(dto, user.userId);
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List user repositories' })
  @ApiResponse({ status: 200, description: 'Paginated repository list' })
  async findAll(
    @CurrentUser() user: { userId: string },
    @Query() query: PaginationQueryDto,
  ): Promise<ApiResponseType<RepositoryResponseDto[]>> {
    const result = await this.repositoryService.findAll(user.userId, query.page, query.limit);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repository details' })
  @ApiResponse({ status: 200, description: 'Repository details', type: RepositoryResponseDto })
  async findById(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<RepositoryResponseDto>> {
    const result = await this.repositoryService.findById(id, user.userId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update repository' })
  @ApiResponse({ status: 200, description: 'Repository updated', type: RepositoryResponseDto })
  async update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateRepositoryDto,
  ): Promise<ApiResponseType<RepositoryResponseDto>> {
    const result = await this.repositoryService.update(id, dto, user.userId);
    return { success: true, data: result };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive repository (soft delete)' })
  @ApiResponse({ status: 200, description: 'Repository archived' })
  async archive(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<void>> {
    await this.repositoryService.archive(id, user.userId);
    return { success: true, data: undefined };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete repository and all associated data' })
  @ApiResponse({ status: 200, description: 'Repository deleted' })
  async delete(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<void>> {
    await this.repositoryService.delete(id, user.userId);
    return { success: true, data: undefined };
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger repository sync' })
  @ApiResponse({ status: 200, description: 'Sync triggered' })
  async triggerSync(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<void>> {
    await this.repositoryService.triggerSync(id, user.userId);
    return { success: true, data: undefined };
  }

  @Get(':id/snapshots')
  @ApiOperation({ summary: 'Get sync history (snapshots)' })
  @ApiResponse({ status: 200, description: 'Paginated snapshot list' })
  async getSnapshots(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ApiResponseType<SnapshotResponseDto[]>> {
    const result = await this.repositoryService.getSyncHistory(
      id,
      user.userId,
      query.page,
      query.limit,
    );
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id/snapshots/:snapshotId')
  @ApiOperation({ summary: 'Get snapshot details' })
  @ApiResponse({ status: 200, description: 'Snapshot details', type: SnapshotResponseDto })
  async getSnapshot(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
  ): Promise<ApiResponseType<SnapshotResponseDto>> {
    const result = await this.repositoryService.getSnapshot(id, snapshotId, user.userId);
    return { success: true, data: result };
  }
}
