import { Injectable, Scope } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Request-scoped service that holds contextual information for the current request.
 *
 * This service is scoped to each request (REQUEST scope) so that each HTTP request
 * gets its own instance. Use the static `get()`` method to access the context from
 * outside the DI container (e.g., in logging utilities).
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private _correlationId: string = randomUUID();
  private _userId?: string;
  private _tenantId?: string;

  /**
   * The correlation ID for the current request.
   * Auto-generated if not set explicitly.
   */
  get correlationId(): string {
    return this._correlationId;
  }

  set correlationId(value: string) {
    this._correlationId = value;
  }

  /**
   * The authenticated user ID, if available.
   * Will be populated by auth middleware in future epics.
   */
  get userId(): string | undefined {
    return this._userId;
  }

  set userId(value: string | undefined) {
    this._userId = value;
  }

  /**
   * The tenant ID for multi-tenant scenarios, if available.
   * Will be populated by tenant resolution middleware in future epics.
   */
  get tenantId(): string | undefined {
    return this._tenantId;
  }

  set tenantId(value: string | undefined) {
    this._tenantId = value;
  }
}
