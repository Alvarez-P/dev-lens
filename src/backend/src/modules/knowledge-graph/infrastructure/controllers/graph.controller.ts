import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GraphQueryService } from '../../application/graph-query.service';
import { GraphNodesQueryDto, GraphEdgesQueryDto } from './graph-query.dto';

@ApiTags('Knowledge Graph')
@Controller({ path: 'graph', version: '1' })
export class GraphController {
  constructor(private readonly graphQueryService: GraphQueryService) {}

  @Get(':repoId')
  @ApiOperation({ summary: 'Get the latest graph snapshot for a repository' })
  @ApiResponse({ status: 200, description: 'Latest graph snapshot with node and edge counts' })
  @ApiResponse({ status: 404, description: 'No graph snapshot exists for the repository' })
  async getLatestSnapshot(@Param('repoId') repoId: string) {
    const snapshot = await this.graphQueryService.getLatestGraphSnapshot(repoId);

    if (snapshot === null) {
      throw new NotFoundException(`No graph snapshot found for repository "${repoId}"`);
    }

    return { success: true, data: snapshot };
  }

  @Get(':repoId/nodes')
  @ApiOperation({ summary: 'List graph nodes for a repository' })
  @ApiResponse({ status: 200, description: 'Paginated nodes scoped to a graph version' })
  @ApiResponse({ status: 400, description: 'Invalid type, version, page, or limit' })
  async getNodes(@Param('repoId') repoId: string, @Query() query: GraphNodesQueryDto) {
    const result = await this.graphQueryService.getNodes(repoId, {
      version: query.version,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });

    return {
      success: true,
      data: result.data.map((node) => node.toJSON()),
      meta: this.pageMeta(result.total, query.page, query.limit),
    };
  }

  @Get(':repoId/nodes/:fqn')
  @ApiOperation({ summary: 'Get a single graph node with its connected edges' })
  @ApiResponse({ status: 200, description: 'Node with all connected edges' })
  @ApiResponse({ status: 404, description: 'No active node exists for the fqn' })
  async getNode(@Param('repoId') repoId: string, @Param('fqn') fqn: string) {
    const result = await this.graphQueryService.getNodeWithEdges(repoId, fqn);

    if (result === null) {
      throw new NotFoundException(`No graph node found for fqn "${fqn}"`);
    }

    return {
      success: true,
      data: {
        node: result.node.toJSON(),
        edges: result.edges.map((edge) => edge.toJSON()),
      },
    };
  }

  @Get(':repoId/edges')
  @ApiOperation({ summary: 'List graph edges for a repository' })
  @ApiResponse({ status: 200, description: 'Paginated edges scoped to a graph version' })
  @ApiResponse({ status: 400, description: 'Invalid type, source, target, offset, or limit' })
  async getEdges(@Param('repoId') repoId: string, @Query() query: GraphEdgesQueryDto) {
    const result = await this.graphQueryService.getEdges(repoId, {
      version: query.version,
      source: query.source,
      target: query.target,
      type: query.type,
      offset: query.offset,
      limit: query.limit,
    });

    return {
      success: true,
      data: result.data.map((edge) => edge.toJSON()),
      meta: {
        total: result.total,
        offset: query.offset,
        limit: query.limit,
      },
    };
  }

  private pageMeta(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}
