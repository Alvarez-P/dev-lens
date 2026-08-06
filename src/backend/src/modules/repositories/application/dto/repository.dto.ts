import { IsString, IsOptional, IsEnum, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryStatus } from '../../domain/repository-status.enum';
import { GitProvider } from '../../domain/git-provider.enum';

export class CreateRepositoryDto {
  @ApiProperty({ example: 'my-project' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'https://github.com/org/repo' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional({ enum: GitProvider, example: 'GITHUB' })
  @IsOptional()
  @IsEnum(GitProvider)
  provider?: GitProvider;

  @ApiPropertyOptional({ example: 'main' })
  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @ApiPropertyOptional({ example: 'uuid-of-workspace' })
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-org' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-credential' })
  @IsOptional()
  @IsUUID()
  credentialId?: string;
}

export class UpdateRepositoryDto {
  @ApiPropertyOptional({ example: 'my-renamed-project' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'develop' })
  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @ApiPropertyOptional({ example: 'uuid-of-credential' })
  @IsOptional()
  credentialId?: string | null;
}

export class RepositoryResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'my-project' })
  name!: string;

  @ApiProperty({ example: 'https://github.com/org/repo' })
  url!: string;

  @ApiProperty({ enum: GitProvider, example: 'GITHUB' })
  provider!: GitProvider;

  @ApiProperty({ example: 'main' })
  defaultBranch!: string;

  @ApiProperty({ enum: RepositoryStatus, example: 'ACTIVE' })
  status!: RepositoryStatus;

  @ApiProperty({ nullable: true, example: 'uuid-of-workspace' })
  workspaceId!: string | null;

  @ApiProperty({ nullable: true, example: 'uuid-of-org' })
  organizationId!: string | null;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ nullable: true })
  credentialId!: string | null;

  @ApiProperty({ nullable: true, example: '2024-01-15T10:00:00Z' })
  lastSyncAt!: string | null;

  @ApiProperty({ nullable: true, example: 'abc123def' })
  lastSyncCommit!: string | null;

  @ApiProperty({ nullable: true, example: 'Authentication failed: repository is private' })
  lastSyncError!: string | null;

  @ApiProperty({ nullable: true, example: 1024000 })
  sizeBytes!: number | null;

  @ApiProperty({ nullable: true, example: 150 })
  fileCount!: number | null;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt!: string;
}
