import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalIdentityRepository } from '@/modules/identity/infrastructure/persistence/repositories/external-identity.repository';
import { ExternalIdentityTypeormEntity } from '@/modules/identity/infrastructure/persistence/typeorm/external-identity.typeorm-entity';
import { TokenEncryptionService } from '@/modules/identity/infrastructure/encryption/token-encryption.service';
import {
  ExternalIdentity,
  ExternalIdentityId,
} from '@/modules/identity/domain/external-identity.entity';

describe('ExternalIdentityRepository', () => {
  let repository: ExternalIdentityRepository;
  let ormRepo: jest.Mocked<Repository<ExternalIdentityTypeormEntity>>;
  let encryptionService: jest.Mocked<TokenEncryptionService>;

  const mockDate = new Date('2024-01-15T10:00:00Z');
  const mockEntity: ExternalIdentityTypeormEntity = {
    id: 'e1b2c3d4-1111-2222-3333-444444444444',
    userId: 'a1b2c3d4-5555-6666-7777-888888888888',
    provider: 'github',
    externalId: 'gh_12345',
    accessToken: 'encrypted_access_token_value',
    refreshToken: 'encrypted_refresh_token_value',
    tokenExpiresAt: new Date('2025-01-01T00:00:00Z'),
    displayName: 'octocat',
    avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(async () => {
    ormRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalIdentityTypeormEntity>>;

    encryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted_value'),
      decrypt: jest.fn().mockImplementation((val: string) => {
        if (val === 'encrypted_access_token_value') return 'mock_gh_plain_access_token';
        if (val === 'encrypted_refresh_token_value') return 'ghr_plain_refresh_token';
        return 'decrypted_' + val;
      }),
    } as unknown as jest.Mocked<TokenEncryptionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalIdentityRepository,
        { provide: getRepositoryToken(ExternalIdentityTypeormEntity), useValue: ormRepo },
        { provide: TokenEncryptionService, useValue: encryptionService },
      ],
    }).compile();

    repository = module.get<ExternalIdentityRepository>(ExternalIdentityRepository);
  });

  describe('findByProvider', () => {
    it('should return the domain entity when a matching identity exists', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const result = await repository.findByProvider('github', 'gh_12345');

      expect(ormRepo.findOne).toHaveBeenCalledWith({
        where: { provider: 'github', externalId: 'gh_12345' },
      });
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted_access_token_value');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted_refresh_token_value');
      expect(result).not.toBeNull();
      expect(result!.id.toString()).toBe(mockEntity.id);
      expect(result!.userId).toBe(mockEntity.userId);
      expect(result!.provider).toBe('github');
      expect(result!.externalId).toBe('gh_12345');
      expect(result!.accessToken).toBe('mock_gh_plain_access_token');
      expect(result!.refreshToken).toBe('ghr_plain_refresh_token');
      expect(result!.displayName).toBe('octocat');
    });

    it('should return null when no matching identity exists', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByProvider('github', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle null refreshToken gracefully', async () => {
      const entityWithoutRefresh = {
        ...mockEntity,
        refreshToken: null,
      };
      ormRepo.findOne.mockResolvedValue(entityWithoutRefresh);

      const result = await repository.findByProvider('github', 'gh_12345');

      expect(result).not.toBeNull();
      expect(result!.refreshToken).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the domain entity by id', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const id = ExternalIdentityId.from(mockEntity.id);
      const result = await repository.findById(id);

      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: mockEntity.id } });
      expect(result).not.toBeNull();
      expect(result!.id.toString()).toBe(mockEntity.id);
    });

    it('should return null when entity is not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const id = ExternalIdentityId.from('nonexistent-id');
      const result = await repository.findById(id);

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return all identities for a user', async () => {
      ormRepo.find.mockResolvedValue([mockEntity]);

      const result = await repository.findByUserId(mockEntity.userId);

      expect(ormRepo.find).toHaveBeenCalledWith({ where: { userId: mockEntity.userId } });
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockEntity.userId);
    });

    it('should return empty array when user has no identities', async () => {
      ormRepo.find.mockResolvedValue([]);

      const result = await repository.findByUserId('user-with-no-identities');

      expect(result).toEqual([]);
    });
  });

  describe('save', () => {
    it('should encrypt tokens before persisting', async () => {
      const identity = ExternalIdentity.create({
        userId: 'a1b2c3d4-user-id',
        provider: 'github',
        externalId: 'gh_new_user',
        accessToken: 'mock_gh_plain_new_token',
        refreshToken: 'ghr_plain_new_refresh',
        displayName: 'newuser',
        avatarUrl: null,
      });

      await repository.save(identity);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('mock_gh_plain_new_token');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('ghr_plain_new_refresh');
      expect(ormRepo.save).toHaveBeenCalledTimes(1);
      const savedEntity = ormRepo.save.mock.calls[0][0] as ExternalIdentityTypeormEntity;
      expect(savedEntity.accessToken).toBe('encrypted_value');
      expect(savedEntity.refreshToken).toBe('encrypted_value');
      expect(savedEntity.provider).toBe('github');
      expect(savedEntity.externalId).toBe('gh_new_user');
    });

    it('should handle null refreshToken', async () => {
      const identity = ExternalIdentity.create({
        userId: 'a1b2c3d4-user-id',
        provider: 'github',
        externalId: 'gh_no_refresh',
        accessToken: 'mock_gh_token_only',
        displayName: null,
        avatarUrl: null,
      });

      await repository.save(identity);

      expect(encryptionService.encrypt).toHaveBeenCalledTimes(1);
      expect(encryptionService.encrypt).toHaveBeenCalledWith('mock_gh_token_only');
      const savedEntity = ormRepo.save.mock.calls[0][0] as ExternalIdentityTypeormEntity;
      expect(savedEntity.refreshToken).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete by id', async () => {
      const id = ExternalIdentityId.from('id-to-delete');

      await repository.delete(id);

      expect(ormRepo.delete).toHaveBeenCalledWith('id-to-delete');
    });
  });
});
