import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTypeOrmEntity } from '../typeorm/user.typeorm-entity';
import { User } from '../../../domain/user.entity';
import { UserId } from '../../../domain/user-id.vo';
import { Email } from '../../../domain/email.vo';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserTypeOrmEntity)
    private readonly ormRepo: Repository<UserTypeOrmEntity>,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const entity = await this.ormRepo.findOne({ where: { id: id.toString() } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const entity = await this.ormRepo.findOne({ where: { email: email.toString() } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async save(user: User): Promise<void> {
    const entity = this.toPersistence(user);
    await this.ormRepo.save(entity);
  }

  async delete(id: UserId): Promise<void> {
    await this.ormRepo.delete(id.toString());
  }

  async exists(id: UserId): Promise<boolean> {
    const count = await this.ormRepo.count({ where: { id: id.toString() } });
    return count > 0;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const count = await this.ormRepo.count({ where: { email: email.toString() } });
    return count > 0;
  }

  private toDomain(entity: UserTypeOrmEntity): User {
    return User.reconstitute(
      UserId.from(entity.id),
      Email.create(entity.email),
      entity.passwordHash,
      entity.firstName,
      entity.lastName,
      entity.avatarUrl,
      entity.isEmailVerified,
      entity.refreshTokenHash,
      entity.lastLoginAt,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private toPersistence(user: User): UserTypeOrmEntity {
    const entity = new UserTypeOrmEntity();
    entity.id = user.id.toString();
    entity.email = user.email.toString();
    entity.passwordHash = user.passwordHash;
    entity.firstName = user.firstName;
    entity.lastName = user.lastName;
    entity.avatarUrl = user.avatarUrl;
    entity.isEmailVerified = user.isEmailVerified;
    entity.refreshTokenHash = user.refreshTokenHash;
    entity.lastLoginAt = user.lastLoginAt;
    entity.createdAt = user.createdAt;
    entity.updatedAt = user.updatedAt;
    return entity;
  }
}
