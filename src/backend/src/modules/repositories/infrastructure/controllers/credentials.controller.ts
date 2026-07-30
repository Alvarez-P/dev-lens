import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CredentialService } from '../../application/credential.service';
import { JwtAuthGuard } from '../../../identity/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import {
  CreateCredentialDto,
  UpdateCredentialDto,
  CredentialResponseDto,
  ValidateCredentialResultDto,
} from '../../application/dto/credential.dto';
import { ApiResponse as ApiResponseType } from '../../../../shared/types/common.types';

@ApiTags('Credentials')
@Controller({ path: 'credentials', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CredentialsController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new credential' })
  @ApiResponse({ status: 201, description: 'Credential created', type: CredentialResponseDto })
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCredentialDto,
  ): Promise<ApiResponseType<CredentialResponseDto>> {
    const result = await this.credentialService.create(dto, user.userId);
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List user credentials' })
  @ApiResponse({ status: 200, description: 'List of credentials' })
  async findAll(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<CredentialResponseDto[]>> {
    const result = await this.credentialService.findByUser(user.userId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get credential details' })
  @ApiResponse({ status: 200, description: 'Credential details', type: CredentialResponseDto })
  async findById(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<CredentialResponseDto>> {
    const result = await this.credentialService.findById(id, user.userId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update credential label' })
  @ApiResponse({ status: 200, description: 'Credential updated', type: CredentialResponseDto })
  async update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCredentialDto,
  ): Promise<ApiResponseType<CredentialResponseDto>> {
    const result = await this.credentialService.update(id, dto, user.userId);
    return { success: true, data: result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete credential' })
  @ApiResponse({ status: 200, description: 'Credential deleted' })
  async delete(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<void>> {
    await this.credentialService.delete(id, user.userId);
    return { success: true, data: undefined };
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate credential against provider' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validate(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<ApiResponseType<ValidateCredentialResultDto>> {
    const result = await this.credentialService.validate(id, user.userId);
    return { success: true, data: result };
  }
}
