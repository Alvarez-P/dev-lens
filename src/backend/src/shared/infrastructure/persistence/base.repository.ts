import { Identifier } from '../../domain/identifier';
import { Entity } from '../../domain/entity';
import { Repository } from '../../interfaces/repository.interface';

export abstract class BaseRepository<
  TEntity extends Entity<TId>,
  TId extends Identifier,
> implements Repository<TEntity, TId> {
  protected readonly items: Map<string, TEntity> = new Map();

  async findById(id: TId): Promise<TEntity | null> {
    const key = id.toString();
    return this.items.get(key) ?? null;
  }

  async save(entity: TEntity): Promise<void> {
    const key = entity.id.toString();
    this.items.set(key, entity);
  }

  async delete(id: TId): Promise<void> {
    const key = id.toString();
    this.items.delete(key);
  }

  async exists(id: TId): Promise<boolean> {
    const key = id.toString();
    return this.items.has(key);
  }

  async findAll(): Promise<TEntity[]> {
    return Array.from(this.items.values());
  }

  protected clear(): void {
    this.items.clear();
  }
}
