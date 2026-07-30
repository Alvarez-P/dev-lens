import { IsString, IsOptional, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Main Workspace', description: 'Workspace name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'Primary workspace for development',
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: 'org-uuid',
    description: 'Organization ID to create the workspace under',
  })
  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Updated Workspace Name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class WorkspaceResponseDto {
  @ApiProperty({ example: 'workspace-uuid' })
  id!: string;

  @ApiProperty({ example: 'Main Workspace' })
  name!: string;

  @ApiProperty({ example: 'main-workspace' })
  slug!: string;

  @ApiProperty({ example: 'Primary workspace', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'org-uuid' })
  organizationId!: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt!: string;
}

export class WorkspaceListResponseDto {
  @ApiProperty({ type: [WorkspaceResponseDto] })
  items!: WorkspaceResponseDto[];

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}
