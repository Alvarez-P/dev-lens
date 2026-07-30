import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthRedirectDto {
  @ApiProperty({ example: 'github', description: 'OAuth provider name' })
  provider!: string;

  @ApiProperty({
    description: 'Authorization URL to redirect the user to',
  })
  authorizationUrl!: string;
}

export class OAuthCallbackQueryDto {
  @ApiProperty({ description: 'Authorization code from the OAuth provider' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'State parameter for CSRF validation' })
  @IsString()
  @IsNotEmpty()
  state!: string;
}

export class LinkedIdentityDto {
  @ApiProperty({ example: 'uuid', description: 'External identity ID' })
  id!: string;

  @ApiProperty({ example: 'github', description: 'OAuth provider name' })
  provider!: string;

  @ApiProperty({ example: 'octocat', description: 'Display name from provider' })
  displayName!: string | null;

  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/583231',
    description: 'Avatar URL from provider',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    example: '2024-01-15T10:00:00Z',
    description: 'When the identity was linked',
  })
  linkedAt!: string;
}

export class UnlinkIdentityDto {
  @ApiProperty({ description: 'ID of the external identity to unlink' })
  @IsString()
  @IsNotEmpty()
  identityId!: string;
}
