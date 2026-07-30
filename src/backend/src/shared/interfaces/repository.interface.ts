import { Identifier } from '../domain/identifier';
import { Entity } from '../domain/entity';

/**
 * Base repository interface following the repository pattern.
 * Defines standard CRUD operations that domain repositories should implement.
 */
export interface Repository<TEntity extends Entity, TId extends Identifier> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
  exists(id: TId): Promise<boolean>;
}
