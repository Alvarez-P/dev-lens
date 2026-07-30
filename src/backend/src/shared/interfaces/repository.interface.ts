import { Identifier } from '../domain/identifier';
import { Entity } from '../domain/entity';

export interface Repository<TEntity extends Entity, TId extends Identifier> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
  exists(id: TId): Promise<boolean>;
}
