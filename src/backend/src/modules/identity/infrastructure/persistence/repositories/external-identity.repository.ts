import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalIdentityTypeormEntity } from '../typeorm/external-identity.typeorm-entity';
import { ExternalIdentity, ExternalIdentityId } from '../../../domain/external-identity.entity';
import { TokenEncryptionService } from '../../encryption/token-encryption.service';

@Injectable()
export class ExternalIdentityRepository {
  constructor(
    @InjectRepository(ExternalIdentityTypeormEntity)
    private readonly ormRepo: Repository<ExternalIdentityTypeormEntity>,
    private readonly tokenEncryptionService: TokenEncryptionService,
  ) {}

  async findById(id: ExternalIdentityId): Promise<ExternalIdentity | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByProvider(provider: string, externalId: string): Promise<ExternalIdentity | null> {
    const entity = await this.ormRepo.findOne({ where: { provider, externalId } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByUserId(userId: string): Promise<ExternalIdentity[]> {
    const entities = await this.ormRepo.find({ where: { userId } });
    return entities.map((e) => this.toDomain(e));
  }

  async save(identity: ExternalIdentity): Promise<void> {
    const entity = this.toPersistence(identity);
    await this.ormRepo.save(entity);
  }

  async delete(id: ExternalIdentityId): Promise<void> {
    await this.ormRepo.delete(id.toString());
  }

  private toDomain(entity: ExternalIdentityTypeormEntity): ExternalIdentity {
    return ExternalIdentity.reconstitute({
      id: entity.id,
      userId: entity.userId,
      provider: entity.provider,
      externalId: entity.externalId,
      accessToken: this.tokenEncryptionService.decrypt(entity.accessToken),
      refreshToken: entity.refreshToken
        ? this.tokenEncryptionService.decrypt(entity.refreshToken)
        : null,
      tokenExpiresAt: entity.tokenExpiresAt,
      displayName: entity.displayName,
      avatarUrl: entity.avatarUrl,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private toPersistence(identity: ExternalIdentity): ExternalIdentityTypeormEntity {
    const entity = new ExternalIdentityTypeormEntity();
    entity.id = identity.id.toString();
    entity.userId = identity.userId;
    entity.provider = identity.provider;
    entity.externalId = identity.externalId;
    entity.accessToken = this.tokenEncryptionService.encrypt(identity.accessToken);
    entity.refreshToken = identity.refreshToken
      ? this.tokenEncryptionService.encrypt(identity.refreshToken)
      : null;
    entity.tokenExpiresAt = identity.tokenExpiresAt;
    entity.displayName = identity.displayName;
    entity.avatarUrl = identity.avatarUrl;
    entity.createdAt = identity.createdAt;
    entity.updatedAt = identity.updatedAt;
    return entity;
  }
}
