import { Injectable, Scope } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private _correlationId: string = randomUUID();
  private _userId?: string;
  private _tenantId?: string;

  get correlationId(): string {
    return this._correlationId;
  }

  set correlationId(value: string) {
    this._correlationId = value;
  }

  get userId(): string | undefined {
    return this._userId;
  }

  set userId(value: string | undefined) {
    this._userId = value;
  }

  get tenantId(): string | undefined {
    return this._tenantId;
  }

  set tenantId(value: string | undefined) {
    this._tenantId = value;
  }
}
