import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../../application/user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import { UpdateProfileDto, UserProfileResponseDto } from '../../application/dto/user.dto';
import { OrganizationResponseDto } from '../../application/dto/organization.dto';
import { WorkspaceResponseDto } from '../../application/dto/workspace.dto';
import { LinkedIdentityDto } from '../../application/dto/oauth.dto';
import { ApiResponse as ApiResponseType } from '../../../../shared/types/common.types';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserProfileResponseDto })
  async getProfile(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<UserProfileResponseDto>> {
    const result = await this.userService.findById(user.userId);
    return { success: true, data: result };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: UserProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<ApiResponseType<UserProfileResponseDto>> {
    const result = await this.userService.updateProfile(user.userId, dto);
    return { success: true, data: result };
  }

  @Get('organizations')
  @ApiOperation({ summary: 'Get organizations the current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of organizations' })
  async getOrganizations(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<OrganizationResponseDto[]>> {
    const result = await this.userService.getUserOrganizations(user.userId);
    return { success: true, data: result };
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'Get workspaces the current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of workspaces' })
  async getWorkspaces(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<WorkspaceResponseDto[]>> {
    const result = await this.userService.getUserWorkspaces(user.userId);
    return { success: true, data: result };
  }

  @Get('identities')
  @ApiOperation({ summary: 'Get linked external identities for current user' })
  @ApiResponse({ status: 200, description: 'List of linked identities' })
  async getLinkedIdentities(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<LinkedIdentityDto[]>> {
    const result = await this.userService.getLinkedIdentities(user.userId);
    return { success: true, data: result };
  }

  @Delete('identities/:identityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an external identity' })
  @ApiResponse({ status: 200, description: 'Identity unlinked successfully' })
  @ApiResponse({ status: 400, description: 'Cannot unlink sole authentication method' })
  async unlinkIdentity(
    @CurrentUser() user: { userId: string },
    @Param('identityId') identityId: string,
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.userService.unlinkIdentity(user.userId, identityId);
    return { success: true, data: { message: 'Identity unlinked successfully' } };
  }
}
