import { Injectable } from '@nestjs/common';

@Injectable()
export class DecoratorRoleRegistry {
  private readonly rolesByDecorator: Map<string, string> = new Map([
    ['Module', 'module'],
    ['Controller', 'controller'],
    ['Injectable', 'service'],
    ['EntityRepository', 'repository'],
    ['Catch', 'exception-filter'],
    ['UseGuards', 'guard'],
    ['UsePipes', 'pipe'],
    ['UseInterceptors', 'interceptor'],
    ['Middleware', 'middleware'],
    ['Body', 'body'],
    ['Param', 'param'],
    ['Query', 'query'],
    ['Headers', 'headers'],
    ['WebSocketGateway', 'gateway'],
    ['EventPattern', 'event-handler'],
    ['MessagePattern', 'message-handler'],
  ]);

  get(name: string): string | null {
    return this.rolesByDecorator.get(name) ?? null;
  }

  getRole(name: string): string | null {
    return this.get(name);
  }

  register(name: string, role: string): void {
    this.rolesByDecorator.set(name, role);
  }
}
