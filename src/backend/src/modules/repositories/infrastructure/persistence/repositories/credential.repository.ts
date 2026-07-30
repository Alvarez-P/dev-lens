import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { CredentialTypeOrmEntity } from '../typeorm/credential.typeorm-entity';
import {
  Credential as DomainCredential,
  CredentialId,
  CredentialType,
  GitProvider,
} from '../../../domain';

@Injectable()
export class CredentialRepository {
  constructor(
    @InjectRepository(CredentialTypeOrmEntity)
    private readonly ormRepo: TypeOrmRepository<CredentialTypeOrmEntity>,
  ) {}

  async findById(id: CredentialId): Promise<DomainCredential | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByOwnerId(ownerId: string): Promise<DomainCredential[]> {
    const entities = await this.ormRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async save(credential: DomainCredential): Promise<void> {
    const entity = this.toPersistence(credential);
    await this.ormRepo.save(entity);
  }

  async delete(id: CredentialId): Promise<void> {
    await this.ormRepo.delete(id.toString());
  }

  private toDomain(entity: CredentialTypeOrmEntity): DomainCredential {
    return DomainCredential.reconstitute(
      CredentialId.from(entity.id),
      entity.ownerId,
      entity.provider as GitProvider,
      entity.name,
      entity.encryptedValue,
      entity.type as CredentialType,
      entity.createdAt,
      entity.expiresAt,
    );
  }

  private toPersistence(credential: DomainCredential): CredentialTypeOrmEntity {
    const entity = new CredentialTypeOrmEntity();
    entity.id = credential.id.toString();
    entity.ownerId = credential.ownerId;
    entity.provider = credential.provider;
    entity.name = credential.name;
    entity.encryptedValue = credential.encryptedValue;
    entity.type = credential.type;
    entity.createdAt = credential.createdAt;
    entity.expiresAt = credential.expiresAt;
    return entity;
  }
}
