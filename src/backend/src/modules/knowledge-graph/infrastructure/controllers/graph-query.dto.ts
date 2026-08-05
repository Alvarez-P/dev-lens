import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NodeType } from '../../domain/node-type.enum';
import { EdgeType } from '../../domain/edge-type.enum';
import { GraphNodeJson } from '../../domain/graph-node.vo';
import { GraphEdgeJson } from '../../domain/graph-edge.vo';

export class GraphNodesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString({ each: true })
  @IsIn(Object.values(NodeType), { each: true })
  type?: NodeType | NodeType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

export class GraphEdgesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsUUID()
  source?: string;

  @IsOptional()
  @IsUUID()
  target?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(EdgeType))
  type?: EdgeType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

export class GraphExportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}

export class GraphQueryNodeDetailDto {
  @IsOptional()
  @IsIn(['in', 'out', 'both'])
  direction: 'in' | 'out' | 'both' = 'both';
}

export class ExportResponseDto {
  @ApiProperty({ description: 'All graph nodes for the requested version' })
  nodes!: GraphNodeJson[];

  @ApiProperty({ description: 'All graph edges for the requested version' })
  edges!: GraphEdgeJson[];

  @ApiProperty({
    description: 'Summary metadata about the exported graph',
    example: { nodeCount: 500, edgeCount: 1200, version: 3 },
  })
  meta!: { nodeCount: number; edgeCount: number; version: number };
}
