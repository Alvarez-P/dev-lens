import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { NodeType } from '../../domain/node-type.enum';
import { EdgeType } from '../../domain/edge-type.enum';

export class GraphNodesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(NodeType))
  type?: NodeType;

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
