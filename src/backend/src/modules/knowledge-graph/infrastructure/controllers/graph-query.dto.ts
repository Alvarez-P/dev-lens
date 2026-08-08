import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NodeType } from '../../domain/node-type.enum';
import { EdgeType } from '../../domain/edge-type.enum';
import { GraphNodeJson } from '../../domain/graph-node.vo';
import { GraphEdgeJson } from '../../domain/graph-edge.vo';
import { FlowStepKind } from '../../application/graph-query.service';

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

export class RequestFlowStepDto {
  @ApiProperty({ description: 'Position of the step within the request flow, starting at 1' })
  order!: number;

  @ApiProperty({
    description: 'Kind of the lifecycle step',
    enum: ['middleware', 'guard', 'pipe', 'interceptor', 'handler', 'service', 'repository'],
  })
  kind!: FlowStepKind;

  @ApiProperty({ description: 'FQN of the graph node representing this step' })
  nodeFqn!: string;

  @ApiProperty({ description: 'Human-readable label of the step node' })
  nodeLabel!: string;

  @ApiProperty({
    description: 'Edge type that connects this step toward the next step in the flow',
    enum: EdgeType,
  })
  edgeType!: EdgeType;

  @ApiProperty({
    description: 'DTO type annotation for handler steps; null otherwise',
    nullable: true,
    example: 'CreateUserDto',
  })
  payloadType!: string | null;

  @ApiProperty({
    description: 'True for the INVOKES-derived service tail, whose order is inferred',
    example: true,
  })
  approximate!: boolean;
}

export class EndpointFlowResponseDto {
  @ApiProperty({
    description: 'Whether the snapshot version carries flow data',
    example: true,
  })
  flowAvailable!: boolean;

  @ApiProperty({ description: 'Ordered request-flow steps', type: [RequestFlowStepDto] })
  steps!: RequestFlowStepDto[];

  @ApiProperty({ description: 'FQN of the endpoint the flow was computed for' })
  endpointFqn!: string;
}
