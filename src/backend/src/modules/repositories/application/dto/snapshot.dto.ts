import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SnapshotStatus } from '../../domain/snapshot.entity';

export class SnapshotResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'uuid' })
  repositoryId!: string;

  @ApiProperty({ example: 'abc123def' })
  commitSha!: string;

  @ApiProperty({ example: 'main' })
  branch!: string;

  @ApiProperty({ example: 'Jane Doe' })
  author!: string;

  @ApiProperty({ example: 'Fix login bug' })
  commitMessage!: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  commitTimestamp!: string;

  @ApiProperty({ example: '2024-01-15T10:05:00Z' })
  syncTimestamp!: string;

  @ApiProperty({ example: 150 })
  fileCount!: number;

  @ApiProperty({ example: 1024000 })
  sizeBytes!: number;

  @ApiProperty({ enum: SnapshotStatus, example: 'PROCESSED' })
  status!: SnapshotStatus;
}
