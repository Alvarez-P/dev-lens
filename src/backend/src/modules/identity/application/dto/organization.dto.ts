import { IsString, IsOptional, IsNotEmpty, MaxLength, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../domain/role.enum';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Organization name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'A software company', description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Acme Corp Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'An updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class AddMemberDto {
  @ApiProperty({ example: 'john@example.com', description: 'Email of the user to add' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: Role, example: Role.MEMBER, description: 'Role to assign' })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role, example: Role.ADMIN, description: 'New role' })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}

export class MemberResponseDto {
  @ApiProperty({ example: 'member-uuid' })
  id!: string;

  @ApiProperty({ example: 'user-uuid' })
  userId!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ enum: Role, example: Role.MEMBER })
  role!: Role;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  joinedAt!: string;
}

export class OrganizationResponseDto {
  @ApiProperty({ example: 'org-uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  slug!: string;

  @ApiProperty({ example: 'A software company', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'owner-uuid' })
  ownerId!: string;

  @ApiProperty({ example: 5, description: 'Number of members' })
  memberCount!: number;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt!: string;
}

export class OrganizationListResponseDto {
  @ApiProperty({ type: [OrganizationResponseDto] })
  items!: OrganizationResponseDto[];

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}
