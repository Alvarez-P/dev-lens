import { Identifier } from '../../domain/identifier';
import { Entity } from '../../domain/entity';
import { Repository } from '../../interfaces/repository.interface';

/**
 * Abstract base repository implementation.
 *
 * Provides standard CRUD operations using an in-memory Map as the data store.
 * This is a scaffold that will be replaced with Prisma/TypeORM in future epics.
 * Domain repositories should extend this class and override methods as needed.
 *
 * @typeParam TEntity - The entity type this repository manages
 * @typeParam TId - The identifier type for the entity
 */
export abstract class BaseRepository<
  TEntity extends Entity<TId>,
  TId extends Identifier,
> implements Repository<TEntity, TId> {
  /**
   * In-memory data store. Maps entity IDs to entities.
   * Replace with database client in future epics.
   */
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

  /**
   * Returns all stored entities.
   */
  async findAll(): Promise<TEntity[]> {
    return Array.from(this.items.values());
  }

  /**
   * Clears all stored entities (useful for testing).
   */
  protected clear(): void {
    this.items.clear();
  }
}
