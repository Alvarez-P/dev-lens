import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'ok-v2';
  }

  getVersion(): string {
    return '2.0.0';
  }
}
