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
import { OrganizationService } from '../../application/organization.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  OrganizationResponseDto,
  MemberResponseDto,
} from '../../application/dto/organization.dto';
import { ApiResponse as ApiResponseType } from '../../../../shared/types/common.types';

@ApiTags('Organizations')
@Controller({ path: 'organizations', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created', type: OrganizationResponseDto })
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateOrganizationDto,
  ): Promise<ApiResponseType<OrganizationResponseDto>> {
    const result = await this.organizationService.create(dto, user.userId);
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations for the current user' })
  @ApiResponse({ status: 200, description: 'List of organizations' })
  async findAll(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<OrganizationResponseDto[]>> {
    const result = await this.organizationService.findAll(user.userId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization details', type: OrganizationResponseDto })
  @ApiResponse({ status: 403, description: 'Not a member of this organization' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<OrganizationResponseDto>> {
    const result = await this.organizationService.findById(id, user.userId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization details' })
  @ApiResponse({ status: 200, description: 'Organization updated', type: OrganizationResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateOrganizationDto,
  ): Promise<ApiResponseType<OrganizationResponseDto>> {
    const result = await this.organizationService.update(id, user.userId, dto);
    return { success: true, data: result };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete organization (owner only)' })
  @ApiResponse({ status: 200, description: 'Organization deleted' })
  @ApiResponse({ status: 403, description: 'Only the owner can delete the organization' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.organizationService.delete(id, user.userId);
    return { success: true, data: { message: 'Organization deleted successfully' } };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<MemberResponseDto[]>> {
    const result = await this.organizationService.getMembers(id, user.userId);
    return { success: true, data: result };
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member to the organization' })
  @ApiResponse({ status: 201, description: 'Member added', type: MemberResponseDto })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  async addMember(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AddMemberDto,
  ): Promise<ApiResponseType<MemberResponseDto>> {
    const result = await this.organizationService.addMember(id, user.userId, dto);
    return { success: true, data: result };
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Change a member role' })
  @ApiResponse({ status: 200, description: 'Member role updated', type: MemberResponseDto })
  async changeMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<ApiResponseType<MemberResponseDto>> {
    const result = await this.organizationService.changeRole(id, memberId, user.userId, dto);
    return { success: true, data: result };
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the organization' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.organizationService.removeMember(id, memberId, user.userId);
    return { success: true, data: { message: 'Member removed successfully' } };
  }
}
