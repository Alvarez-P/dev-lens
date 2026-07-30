import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GitProvider } from '../../domain/git-provider.enum';
import { CredentialType } from '../../domain/credential.entity';

// ─── Create ──────────────────────────────────────────────────────

export class CreateCredentialDto {
  @ApiProperty({ enum: GitProvider, example: 'GITHUB' })
  @IsEnum(GitProvider)
  provider!: GitProvider;

  @ApiProperty({ example: 'My GitHub PAT' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: CredentialType, example: 'PAT' })
  @IsEnum(CredentialType)
  type!: CredentialType;

  @ApiProperty({ example: 'ghp_xxxxxxxxxxxx' })
  @IsString()
  @MinLength(1)
  value!: string;

  @ApiPropertyOptional({ example: '2025-01-15T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// ─── Update ──────────────────────────────────────────────────────

export class UpdateCredentialDto {
  @ApiPropertyOptional({ example: 'Updated label' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;
}

// ─── Response ────────────────────────────────────────────────────

export class CredentialResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ enum: GitProvider, example: 'GITHUB' })
  provider!: GitProvider;

  @ApiProperty({ example: 'My GitHub PAT' })
  name!: string;

  @ApiProperty({ enum: CredentialType, example: 'PAT' })
  type!: CredentialType;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: '2025-01-15T10:00:00Z' })
  expiresAt!: string | null;
}

// ─── Validate ────────────────────────────────────────────────────

export class ValidateCredentialResultDto {
  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiProperty({ nullable: true })
  message?: string;
}
