import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRootInfo(): { name: string; version: string } {
    return {
      name: 'DevLens API',
      version: '0.1.0',
    };
  }
}
