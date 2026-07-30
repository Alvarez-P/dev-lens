import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceService } from '../../application/workspace.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
} from '../../application/dto/workspace.dto';
import { MemberResponseDto } from '../../application/dto/organization.dto';
import { ApiResponse as ApiResponseType } from '../../../../shared/types/common.types';

class AddWorkspaceMemberDto {
  @ApiProperty({ description: 'User ID to add to the workspace' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}

@ApiTags('Workspaces')
@Controller({ path: 'workspaces', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspacesController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created', type: WorkspaceResponseDto })
  @ApiResponse({ status: 403, description: 'Not a member of the organization' })
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateWorkspaceDto,
  ): Promise<ApiResponseType<WorkspaceResponseDto>> {
    const result = await this.workspaceService.create(dto, user.userId);
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces for the current user' })
  @ApiResponse({ status: 200, description: 'List of workspaces' })
  async findAll(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<WorkspaceResponseDto[]>> {
    const result = await this.workspaceService.findAll(user.userId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiResponse({ status: 200, description: 'Workspace details', type: WorkspaceResponseDto })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<WorkspaceResponseDto>> {
    const result = await this.workspaceService.findById(id, user.userId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace details' })
  @ApiResponse({ status: 200, description: 'Workspace updated', type: WorkspaceResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<ApiResponseType<WorkspaceResponseDto>> {
    const result = await this.workspaceService.update(id, user.userId, dto);
    return { success: true, data: result };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.workspaceService.delete(id, user.userId);
    return { success: true, data: { message: 'Workspace deleted successfully' } };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get workspace members' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<MemberResponseDto[]>> {
    const result = await this.workspaceService.getMembers(id, user.userId);
    return { success: true, data: result };
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member to the workspace' })
  @ApiResponse({ status: 201, description: 'Member added', type: MemberResponseDto })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddWorkspaceMemberDto,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<MemberResponseDto>> {
    const result = await this.workspaceService.addMember(id, dto.userId, user.userId);
    return { success: true, data: result };
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the workspace' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.workspaceService.removeMember(id, memberId, user.userId);
    return { success: true, data: { message: 'Member removed successfully' } };
  }
}
