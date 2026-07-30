import { Controller, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({
    status: 200,
    description: 'API information retrieved successfully',
  })
  getRoot(): { name: string; version: string } {
    return this.appService.getRootInfo();
  }
}
