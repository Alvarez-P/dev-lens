import { Injectable, Logger } from '@nestjs/common';

/**
 * Structured logger service wrapping NestJS Logger.
 * Log levels are managed by nestjs-pino configuration in AppModule.
 */
@Injectable()
export class LoggerService extends Logger {}
